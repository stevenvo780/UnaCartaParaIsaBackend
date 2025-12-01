import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import { TerrainSystem } from "../../src/domain/simulation/systems/core/TerrainSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

function createTile(x: number, y: number) {
  return {
    x,
    y,
    biome: "grassland",
    isWalkable: true,
    assets: {
      terrain: "terrain_grassland",
      vegetation: [],
      structures: [],
    },
  };
}

describe("TerrainSystem", () => {
  let gameState: GameState;
  let terrainSystem: TerrainSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gameState = createMockGameState();
    gameState.world = {
      ...gameState.world,
      terrain: [
        [createTile(0, 0), createTile(1, 0)],
        [createTile(0, 1), createTile(1, 1)],
      ],
    };

    emitSpy = vi.spyOn(simulationEvents, "emit").mockReturnValue(true);
    terrainSystem = new TerrainSystem(gameState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("debe retornar una instancia válida al llamar getTile()", () => {
    const tile = terrainSystem.getTile(1, 0);
    expect(tile).toBeDefined();
    expect(tile?.x).toBe(1);
    expect(tile?.y).toBe(0);
  });

  it("debe retornar null en getTile() si la coordenada está fuera del mapa", () => {
    expect(terrainSystem.getTile(5, 5)).toBeNull();
  });

  it("debe modificar el terreno y emitir TERRAIN_MODIFIED", () => {
    const result = terrainSystem.modifyTile(0, 0, {
      assets: { terrain: "terrain_dirt" },
    });

    expect(result).toBe(true);
    const updatedTile = terrainSystem.getTile(0, 0);
    expect(updatedTile?.assets.terrain).toBe("terrain_dirt");
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.TERRAIN_MODIFIED,
      expect.objectContaining({
        x: 0,
        updates: expect.objectContaining({
          assets: expect.objectContaining({ terrain: "terrain_dirt" }),
        }),
      }),
    );
  });

  it("debe permitir actualizar vegetación cuando se especifica en assets", () => {
    const vegetation = ["tree_oak"];
    const result = terrainSystem.modifyTile(1, 1, {
      assets: { vegetation },
    });

    expect(result).toBe(true);
    const tile = terrainSystem.getTile(1, 1);
    expect(tile?.assets.vegetation).toEqual(vegetation);
  });

  it("debe retornar false cuando no existe el tile a modificar", () => {
    const result = terrainSystem.modifyTile(10, 10, {
      assets: { terrain: "terrain_dirt" },
    });
    expect(result).toBe(false);
    expect(emitSpy).not.toHaveBeenCalledWith(
      GameEventNames.TERRAIN_MODIFIED,
      expect.anything(),
    );
  });
});
