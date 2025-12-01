import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import type { ResourceType } from "../../src/domain/types/simulation/economy";
import { ProductionSystem } from "../../src/domain/simulation/systems/world/ProductionSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

class MockInventorySystem {
  private byZone = new Map<
    string,
    { id: string; zoneId: string; resources: Record<string, number> }
  >();

  public getStockpilesInZone = vi.fn((zoneId: string) => {
    const stockpile = this.byZone.get(zoneId);
    return stockpile ? [stockpile] : [];
  });

  public createStockpile = vi.fn(
    (zoneId: string, _type: string, _capacity: number) => {
      const stockpile = {
        id: `${zoneId}-stockpile`,
        zoneId,
        resources: {} as Record<string, number>,
      };
      this.byZone.set(zoneId, stockpile);
      return stockpile;
    },
  );

  public addToStockpile = vi.fn(
    (stockpileId: string, resource: ResourceType, amount: number) => {
      const stockpile = Array.from(this.byZone.values()).find(
        (s) => s.id === stockpileId,
      );
      if (stockpile) {
        stockpile.resources[resource] =
          (stockpile.resources[resource] ?? 0) + amount;
      }
    },
  );

  public getResources(zoneId: string): Record<string, number> {
    return this.byZone.get(zoneId)?.resources ?? {};
  }
}

class MockLifeCycleSystem {
  constructor(private readonly agents: Array<{ id: string }>) {}
  public getAgents = vi.fn(() => this.agents);
}

class MockTerrainSystem {
  public getTile = vi.fn(() => ({
    assets: { terrain: "terrain_grassland" },
  }));
  public modifyTile = vi.fn();
}

const UPDATE_INTERVAL = 5000;
const PRODUCTION_INTERVAL = 12000;

describe("ProductionSystem", () => {
  let gameState: GameState;
  let inventorySystem: MockInventorySystem;
  let lifeCycleSystem: MockLifeCycleSystem;
  let terrainSystem: MockTerrainSystem;
  let productionSystem: ProductionSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  const runUpdateAt = (ms: number): void => {
    vi.setSystemTime(ms);
    productionSystem.update(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    emitSpy = vi.spyOn(simulationEvents, "emit");

    gameState = createMockGameState({
      zones: [
        {
          id: "zone_food",
          type: "food",
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          metadata: {},
        },
      ],
    });

    inventorySystem = new MockInventorySystem();
    lifeCycleSystem = new MockLifeCycleSystem([
      { id: "worker-1" },
      { id: "worker-2" },
    ]);
    terrainSystem = new MockTerrainSystem();

    productionSystem = new ProductionSystem(
      gameState,
      inventorySystem as unknown as any,
      lifeCycleSystem as unknown as any,
    );
    (productionSystem as any).terrainSystem = terrainSystem as unknown as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("no produce antes de cumplir intervalos", () => {
    runUpdateAt(1000);
    expect(inventorySystem.addToStockpile).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      GameEventNames.PRODUCTION_OUTPUT_GENERATED,
      expect.anything(),
    );
  });

  it("produce recursos y modifica el terreno cuando se cumplen los intervalos", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    runUpdateAt(UPDATE_INTERVAL + 100); // asigna trabajadores
    emitSpy.mockClear();

    runUpdateAt(UPDATE_INTERVAL + PRODUCTION_INTERVAL + 100);

    expect(inventorySystem.createStockpile).toHaveBeenCalledWith(
      "zone_food",
      "general",
      150,
    );
    expect(inventorySystem.addToStockpile).toHaveBeenCalled();
    expect(inventorySystem.getResources("zone_food")["food"]).toBe(8);
    expect(terrainSystem.getTile).toHaveBeenCalled();
    expect(terrainSystem.modifyTile).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.PRODUCTION_OUTPUT_GENERATED,
      expect.objectContaining({
        zoneId: "zone_food",
        resource: "food",
        amount: 8,
      }),
    );
  });

  it("emite PRODUCTION_WORKER_REMOVED cuando un trabajador muere", () => {
    runUpdateAt(UPDATE_INTERVAL + 100);
    emitSpy.mockClear();

    simulationEvents.emit(GameEventNames.AGENT_DEATH, {
      entityId: "worker-1",
    });
    simulationEvents.flushEvents();

    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.PRODUCTION_WORKER_REMOVED,
      expect.objectContaining({
        workerId: "worker-1",
        zoneId: "zone_food",
      }),
    );
  });
});
