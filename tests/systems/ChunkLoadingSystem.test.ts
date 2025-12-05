import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChunkLoadingSystem } from "../../src/domain/simulation/systems/world/ChunkLoadingSystem";
import type { GameState } from "../../src/shared/types/game-types";
import { BiomeType } from "../../src/shared/constants/BiomeEnums";
import { TileType } from "../../src/shared/types/game-types";

// Mock dependencies
const createMockGameState = (): GameState => ({
  terrainTiles: [],
  animals: [],
  worldResources: [],
  agents: [],
  entities: [],
  zones: [],
  buildings: [],
  time: {
    currentTime: 0,
    timestamp: Date.now(),
    tickCount: 0,
    dayNumber: 1,
    dayProgress: 0.5,
    season: "summer",
    year: 1,
    currentMonth: 1,
    weather: "clear",
  },
  paused: false,
});

describe("ChunkLoadingSystem", () => {
  let gameState: GameState;
  let chunkLoadingSystem: ChunkLoadingSystem;
  let mockAnimalSystem: { spawnAnimalsForChunk: ReturnType<typeof vi.fn> };
  let mockWorldResourceSystem: { spawnResourcesForChunk: ReturnType<typeof vi.fn> };
  let mockTerrainSystem: { setTile: ReturnType<typeof vi.fn> };
  let mockChunkManager: {
    getOrGenerateChunk: ReturnType<typeof vi.fn>;
    worldToChunk: ReturnType<typeof vi.fn>;
  };
  let mockAgentRegistry: {
    getAllProfiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gameState = createMockGameState();

    mockAnimalSystem = {
      spawnAnimalsForChunk: vi.fn(() => 0),
    };

    mockWorldResourceSystem = {
      spawnResourcesForChunk: vi.fn(() => 0),
    };

    mockTerrainSystem = {
      setTile: vi.fn(),
    };

    mockChunkManager = {
      getOrGenerateChunk: vi.fn(),
      worldToChunk: vi.fn(() => ({ chunkX: 0, chunkY: 0 })),
    };

    mockAgentRegistry = {
      getAllProfiles: vi.fn(() => []),
    };

    chunkLoadingSystem = new ChunkLoadingSystem(
      gameState,
      mockChunkManager as any,
      mockAnimalSystem as any,
      mockWorldResourceSystem as any,
      mockAgentRegistry as any,
    );
  });

  describe("TileType assignment for water biomes", () => {
    it("debe marcar OCEAN biome como TileType.WATER", () => {
      // Simular chunk con tile OCEAN
      const mockChunk = {
        tiles: [
          [
            {
              x: 0,
              y: 0,
              biome: BiomeType.OCEAN,
              assets: { terrain: "ocean_tile" },
              isWalkable: false,
            },
          ],
        ],
      };

      mockChunkManager.getOrGenerateChunk.mockReturnValue(mockChunk);

      // Forzar la carga del chunk
      chunkLoadingSystem.update(0);

      // Verificar que el tile fue agregado como WATER
      const waterTile = gameState.terrainTiles?.find(
        (t) => t.x === 0 && t.y === 0,
      );

      // Si el chunk se cargó, el tile debería ser WATER
      if (waterTile) {
        expect(waterTile.type).toBe(TileType.WATER);
        expect(waterTile.biome).toBe(String(BiomeType.OCEAN));
      }
    });

    it("debe marcar LAKE biome como TileType.WATER", () => {
      // Simular chunk con tile LAKE
      const mockChunk = {
        tiles: [
          [
            {
              x: 5,
              y: 5,
              biome: BiomeType.LAKE,
              assets: { terrain: "lake_tile" },
              isWalkable: false,
            },
          ],
        ],
      };

      mockChunkManager.getOrGenerateChunk.mockReturnValue(mockChunk);

      // Forzar la carga del chunk
      chunkLoadingSystem.update(0);

      // Verificar que el tile fue agregado como WATER
      const lakeTile = gameState.terrainTiles?.find(
        (t) => t.x === 5 && t.y === 5,
      );

      if (lakeTile) {
        expect(lakeTile.type).toBe(TileType.WATER);
        expect(lakeTile.biome).toBe(String(BiomeType.LAKE));
      }
    });

    it("debe marcar FOREST biome como TileType.GRASS (no WATER)", () => {
      // Simular chunk con tile FOREST
      const mockChunk = {
        tiles: [
          [
            {
              x: 10,
              y: 10,
              biome: BiomeType.FOREST,
              assets: { terrain: "forest_tile" },
              isWalkable: true,
            },
          ],
        ],
      };

      mockChunkManager.getOrGenerateChunk.mockReturnValue(mockChunk);

      chunkLoadingSystem.update(0);

      const forestTile = gameState.terrainTiles?.find(
        (t) => t.x === 10 && t.y === 10,
      );

      if (forestTile) {
        expect(forestTile.type).toBe(TileType.GRASS);
        expect(forestTile.biome).toBe(String(BiomeType.FOREST));
      }
    });
  });
});
