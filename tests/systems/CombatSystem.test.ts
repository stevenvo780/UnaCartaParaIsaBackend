import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import type { ResourceType } from "../../src/domain/types/simulation/economy";
import { CombatSystem } from "../../src/domain/simulation/systems/CombatSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

class MockInventorySystem {
  private inventories = new Map<string, Record<string, number>>();

  public initializeAgentInventory = vi.fn((agentId: string) => {
    if (!this.inventories.has(agentId)) {
      this.inventories.set(agentId, {});
    }
    return this.inventories.get(agentId)!;
  });

  public getAgentInventory = vi.fn((agentId: string) => {
    return this.inventories.get(agentId);
  });

  public addResource = vi.fn(
    (agentId: string, resource: ResourceType, amount: number) => {
      const inventory = this.initializeAgentInventory(agentId);
      inventory[resource] = (inventory[resource] ?? 0) + amount;
    },
  );

  public removeFromAgent = vi.fn(
    (agentId: string, resource: ResourceType, amount: number) => {
      const inventory = this.inventories.get(agentId);
      if (!inventory || (inventory[resource] ?? 0) < amount) return false;
      inventory[resource]! -= amount;
      return true;
    },
  );
}

class MockLifeCycleSystem {
  private profiles = new Map<string, { traits?: { aggression?: number } }>();

  constructor(profiles: Record<string, { traits?: { aggression?: number } }>) {
    Object.entries(profiles).forEach(([id, profile]) => {
      this.profiles.set(id, profile);
    });
  }

  public getAgent = vi.fn((id: string) => this.profiles.get(id));
  public removeAgent = vi.fn();
}

class MockSocialSystem {
  private affinities = new Map<string, number>();

  public setAffinity(attackerId: string, targetId: string, value: number): void {
    this.affinities.set(`${attackerId}:${targetId}`, value);
  }

  public getAffinityBetween = vi.fn((attackerId: string, targetId: string) => {
    return this.affinities.get(`${attackerId}:${targetId}`) ?? 0;
  });

  public imposeTruce = vi.fn();
}

describe("CombatSystem", () => {
  let gameState: GameState;
  let inventorySystem: MockInventorySystem;
  let lifeCycleSystem: MockLifeCycleSystem;
  let socialSystem: MockSocialSystem;
  let combatSystem: CombatSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  const attackerEntity = {
    id: "attacker",
    type: "agent",
    position: { x: 0, y: 0 },
    isDead: false,
    stats: { health: 100 },
  };

  const targetEntity = {
    id: "target",
    type: "agent",
    position: { x: 10, y: 0 },
    isDead: false,
    stats: { health: 5 },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    emitSpy = vi.spyOn(simulationEvents, "emit");

    gameState = createMockGameState({
      worldSize: { width: 200, height: 200 },
      entities: [attackerEntity, targetEntity],
      zones: [
        {
          id: "zone-1",
          type: "town",
          bounds: { x: 0, y: 0, width: 50, height: 50 },
        },
      ],
    });
    gameState.combatLog = [];

    inventorySystem = new MockInventorySystem();
    lifeCycleSystem = new MockLifeCycleSystem({
      attacker: { traits: { aggression: 1 } },
      target: { traits: { aggression: 0.2 } },
    });
    socialSystem = new MockSocialSystem();
    socialSystem.setAffinity("attacker", "target", -0.8);

    combatSystem = new CombatSystem(
      gameState,
      inventorySystem as unknown as any,
      lifeCycleSystem as unknown as any,
      socialSystem as unknown as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("getNearbyEnemies detecta hostiles cercanos", () => {
    const enemies = combatSystem.getNearbyEnemies("attacker");
    expect(enemies).toContain("target");
  });

  it("update emite eventos de combate y elimina al objetivo cuando la salud llega a cero", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    vi.setSystemTime(1000);
    combatSystem.update(0);

    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.COMBAT_HIT,
      expect.objectContaining({ targetId: "target" }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.COMBAT_KILL,
      expect.objectContaining({ targetId: "target" }),
    );
    expect(gameState.combatLog?.length).toBeGreaterThan(0);
    expect(
      gameState.entities?.find((entity) => entity.id === "target")?.isDead,
    ).toBe(true);
    expect(lifeCycleSystem.removeAgent).toHaveBeenCalledWith("target");
  });

  it("craftWeapon consume recursos y emite evento", () => {
    inventorySystem.addResource("attacker", "wood", 10);

    const crafted = combatSystem.craftWeapon("attacker", "wooden_club");
    expect(crafted).toBe(true);
    expect(inventorySystem.removeFromAgent).toHaveBeenCalledWith(
      "attacker",
      "wood",
      10,
    );
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.COMBAT_WEAPON_CRAFTED,
      expect.objectContaining({ agentId: "attacker", weapon: "wooden_club" }),
    );
  });

  it("craftWeapon retorna false si faltan recursos", () => {
    const crafted = combatSystem.craftWeapon("attacker", "wooden_club");
    expect(crafted).toBe(false);
  });
});
