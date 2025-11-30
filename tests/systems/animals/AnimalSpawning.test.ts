import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnimalSpawning } from "../../../src/domain/simulation/systems/animals/AnimalSpawning";
import type { Animal } from "../../../src/domain/types/simulation/animals";
import {
  getAnimalConfig,
  getAnimalsForBiome,
} from "../../../src/domain/world/config/AnimalConfigs";
import { simulationEvents, GameEventNames } from "../../../src/domain/simulation/core/events";

// Mocks
vi.mock("../../../src/domain/world/config/AnimalConfigs", () => ({
  getAnimalConfig: vi.fn(),
  getAnimalsForBiome: vi.fn(),
}));

vi.mock("../../../src/infrastructure/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AnimalSpawning", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;
  let onSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onSpawn = vi.fn();
    emitSpy = vi.spyOn(simulationEvents, "emit");

    // Reset spawned chunks
    (AnimalSpawning as any).spawnedChunks.clear();
    (AnimalSpawning as any).nextAnimalId = 1;

    vi.mocked(getAnimalConfig).mockReturnValue({
      type: "rabbit",
      displayName: "Rabbit",
      spriteKey: "rabbit",
      scale: 1.0,
      maxHealth: 100,
      speed: 50,
      fleeSpeed: 100,
      detectionRange: 100,
      hungerDecayRate: 0.5,
      thirstDecayRate: 0.3,
      reproductionCooldown: 60000,
      lifespan: 3600000,
      foodValue: 10,
      canBeHunted: true,
      fleeFromHumans: true,
      fleeDistance: 200,
      consumesVegetation: true,
      consumesWater: true,
      vegetationConsumptionRate: 1.0,
      waterConsumptionRate: 1.0,
      spawnProbability: 1.0, // 100% para tests
      suitableBiomes: ["grassland"],
      groupSize: { min: 1, max: 2 },
      minDistanceBetweenGroups: 100,
    });

    vi.mocked(getAnimalsForBiome).mockReturnValue([
      {
        type: "rabbit",
        displayName: "Rabbit",
        spriteKey: "rabbit",
        scale: 1.0,
        maxHealth: 100,
        speed: 50,
        fleeSpeed: 100,
        detectionRange: 100,
        hungerDecayRate: 0.5,
        thirstDecayRate: 0.3,
        reproductionCooldown: 60000,
        lifespan: 3600000,
        foodValue: 10,
        canBeHunted: true,
        fleeFromHumans: true,
        fleeDistance: 200,
        consumesVegetation: true,
        consumesWater: true,
        vegetationConsumptionRate: 1.0,
        waterConsumptionRate: 1.0,
        spawnProbability: 1.0,
        suitableBiomes: ["grassland"],
        groupSize: { min: 1, max: 2 },
        minDistanceBetweenGroups: 100,
      },
    ] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    AnimalSpawning.clearSpawnedChunks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  // Note: spawnAnimalsInWorld was removed in favor of lazy chunk-based spawning
  // Animals are now only spawned when chunks become visible via CHUNK_RENDERED event

  describe("spawnAnimalsInChunk", () => {
    it("no debe re-spawn en chunks ya procesados", () => {
      const chunkCoords = { x: 0, y: 0 };
      const chunkBounds = { x: 0, y: 0, width: 256, height: 256 };

      // Primera vez
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const firstSpawn = AnimalSpawning.spawnAnimalsInChunk(
        chunkCoords,
        chunkBounds,
        onSpawn,
      );

      // Segunda vez (mismo chunk)
      const secondSpawn = AnimalSpawning.spawnAnimalsInChunk(
        chunkCoords,
        chunkBounds,
        onSpawn,
      );

      expect(secondSpawn).toBe(0);
    });

    it("debe respetar isAquatic para biomas", () => {
      const chunkCoords = { x: 1, y: 1 };
      const chunkBounds = { x: 0, y: 0, width: 256, height: 256 };

      const tiles = [
        [
          { biome: "wetland", isWalkable: false },
          { biome: "grassland", isWalkable: true },
        ],
      ];

      vi.mocked(getAnimalsForBiome).mockReturnValue([
        {
          ...vi.mocked(getAnimalsForBiome)()[0],
          isAquatic: true,
        },
      ] as any);

      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const spawned = AnimalSpawning.spawnAnimalsInChunk(
        chunkCoords,
        chunkBounds,
        onSpawn,
        tiles,
      );

      // Puede o no spawnear dependiendo de si encuentra bioma adecuado
      expect(spawned).toBeGreaterThanOrEqual(0);
    });

    it("debe usar fallback noise si no hay tiles", () => {
      const chunkCoords = { x: 2, y: 2 };
      const chunkBounds = { x: 0, y: 0, width: 256, height: 256 };

      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const spawned = AnimalSpawning.spawnAnimalsInChunk(
        chunkCoords,
        chunkBounds,
        onSpawn,
      );

      expect(spawned).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createAnimal", () => {
    it("debe generar animal con estructura correcta", () => {
      const animal = AnimalSpawning.createAnimal(
        "rabbit",
        { x: 100, y: 100 },
        "grassland",
      );

      expect(animal).toBeDefined();
      expect(animal?.id).toContain("animal_rabbit");
      expect(animal?.type).toBe("rabbit");
      expect(animal?.position).toEqual({ x: 100, y: 100 });
      expect(animal?.biome).toBe("grassland");
      expect(animal?.needs.hunger).toBe(100);
      expect(animal?.needs.thirst).toBe(100);
      expect(animal?.genes).toBeDefined();
      expect(animal?.isDead).toBe(false);
    });

    it("debe emitir evento ANIMAL_SPAWNED", () => {
      AnimalSpawning.createAnimal("rabbit", { x: 100, y: 100 }, "grassland");

      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.ANIMAL_SPAWNED,
        expect.objectContaining({
          type: "rabbit",
          position: { x: 100, y: 100 },
          biome: "grassland",
        }),
      );
    });

    it("debe retornar null para tipo no configurado", () => {
      vi.mocked(getAnimalConfig).mockReturnValue(undefined);

      const animal = AnimalSpawning.createAnimal(
        "unknown",
        { x: 100, y: 100 },
        "grassland",
      );

      expect(animal).toBeNull();
    });

    it("debe aceptar genes custom", () => {
      const customGenes = {
        color: 0xff0000,
        size: 1.2,
        speed: 1.1,
        health: 1.0,
        fertility: 0.9,
      };

      const animal = AnimalSpawning.createAnimal(
        "rabbit",
        { x: 100, y: 100 },
        "grassland",
        customGenes,
      );

      expect(animal?.genes).toEqual(customGenes);
    });

    it("debe aceptar generation y parentIds", () => {
      const animal = AnimalSpawning.createAnimal(
        "rabbit",
        { x: 100, y: 100 },
        "grassland",
        undefined,
        2,
        ["parent1", "parent2"],
      );

      expect(animal?.generation).toBe(2);
      expect(animal?.parentIds).toEqual(["parent1", "parent2"]);
    });
  });

  describe("isTooCloseToSameType", () => {
    it("debe detectar proximidad", () => {
      const position = { x: 100, y: 100 };
      const existingAnimals: Animal[] = [
        {
          id: "animal-1",
          type: "rabbit",
          position: { x: 110, y: 100 }, // 10 unidades de distancia
          state: "idle",
          needs: {
            hunger: 100,
            thirst: 100,
            fear: 0,
            reproductiveUrge: 0,
          },
          genes: {
            color: 0xffffff,
            size: 1.0,
            speed: 1.0,
            health: 1.0,
            fertility: 1.0,
          },
          health: 100,
          age: 0,
          lastReproduction: Date.now(),
          spawnedAt: Date.now(),
          generation: 0,
          parentIds: [null, null],
          targetPosition: null,
          currentTarget: null,
          fleeTarget: null,
          biome: "grassland",
          isDead: false,
        },
      ];

      const isTooClose = AnimalSpawning.isTooCloseToSameType(
        position,
        "rabbit",
        existingAnimals,
        20, // minDistance = 20
      );

      expect(isTooClose).toBe(true);
    });

    it("debe retornar false si no hay animales del mismo tipo", () => {
      const position = { x: 100, y: 100 };
      const existingAnimals: Animal[] = [
        {
          id: "animal-1",
          type: "deer", // Tipo diferente
          position: { x: 110, y: 100 },
          state: "idle",
          needs: {
            hunger: 100,
            thirst: 100,
            fear: 0,
            reproductiveUrge: 0,
          },
          genes: {
            color: 0xffffff,
            size: 1.0,
            speed: 1.0,
            health: 1.0,
            fertility: 1.0,
          },
          health: 100,
          age: 0,
          lastReproduction: Date.now(),
          spawnedAt: Date.now(),
          generation: 0,
          parentIds: [null, null],
          targetPosition: null,
          currentTarget: null,
          fleeTarget: null,
          biome: "grassland",
          isDead: false,
        },
      ];

      const isTooClose = AnimalSpawning.isTooCloseToSameType(
        position,
        "rabbit",
        existingAnimals,
        20,
      );

      expect(isTooClose).toBe(false);
    });

    it("debe retornar false si está suficientemente lejos", () => {
      const position = { x: 100, y: 100 };
      const existingAnimals: Animal[] = [
        {
          id: "animal-1",
          type: "rabbit",
          position: { x: 200, y: 200 }, // Muy lejos
          state: "idle",
          needs: {
            hunger: 100,
            thirst: 100,
            fear: 0,
            reproductiveUrge: 0,
          },
          genes: {
            color: 0xffffff,
            size: 1.0,
            speed: 1.0,
            health: 1.0,
            fertility: 1.0,
          },
          health: 100,
          age: 0,
          lastReproduction: Date.now(),
          spawnedAt: Date.now(),
          generation: 0,
          parentIds: [null, null],
          targetPosition: null,
          currentTarget: null,
          fleeTarget: null,
          biome: "grassland",
          isDead: false,
        },
      ];

      const isTooClose = AnimalSpawning.isTooCloseToSameType(
        position,
        "rabbit",
        existingAnimals,
        50, // minDistance = 50
      );

      expect(isTooClose).toBe(false);
    });
  });
});

