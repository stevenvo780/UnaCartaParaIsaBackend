import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import type { Animal } from "../../src/domain/types/simulation/animals";
import { AnimalSystem } from "../../src/domain/simulation/systems/world/animals/AnimalSystem";
import { AnimalNeeds } from "../../src/domain/simulation/systems/world/animals/AnimalNeeds";
import { AnimalBehavior } from "../../src/domain/simulation/systems/world/animals/AnimalBehavior";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

const batchMocks = vi.hoisted(() => ({
  batchIds: [] as string[],
  rebuildBuffers: vi.fn(),
  updateNeedsBatch: vi.fn(),
  updateAgesBatch: vi.fn(),
  syncToAnimals: vi.fn(),
}));

vi.mock("../../src/domain/simulation/systems/AnimalBatchProcessor", () => ({
  AnimalBatchProcessor: class {
    rebuildBuffers = batchMocks.rebuildBuffers;
    getAnimalIdArray = () => batchMocks.batchIds;
    updateNeedsBatch = batchMocks.updateNeedsBatch;
    updateAgesBatch = batchMocks.updateAgesBatch;
    syncToAnimals = batchMocks.syncToAnimals;
  },
}));

const configMocks = vi.hoisted(() => ({
  getAnimalConfig: vi.fn(() => ({
    type: "rabbit",
    displayName: "Rabbit",
    spriteKey: "rabbit",
    scale: 1,
    maxHealth: 100,
    speed: 1,
    fleeSpeed: 1.5,
    detectionRange: 100,
    hungerDecayRate: 0.1,
    thirstDecayRate: 0.1,
    reproductionCooldown: 1000,
    lifespan: 100000,
    foodValue: 10,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 150,
    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 5,
    waterConsumptionRate: 5,
    spawnProbability: 1,
    suitableBiomes: ["forest"],
    groupSize: { min: 1, max: 2 },
    minDistanceBetweenGroups: 0,
  })),
}));

vi.mock("../../src/domain/world/config/AnimalConfigs", () => ({
  getAnimalConfig: configMocks.getAnimalConfig,
}));

describe("AnimalSystem", () => {
  let gameState: GameState;
  let animalSystem: AnimalSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;
  let updateNeedsSpy: ReturnType<typeof vi.spyOn>;
  let wanderSpy: ReturnType<typeof vi.spyOn>;

  const createAnimal = (id: string, overrides: Partial<Animal> = {}): Animal => ({
    id,
    type: "rabbit",
    position: { x: 0, y: 0 },
    state: "idle",
    needs: { hunger: 100, thirst: 100, fear: 0, reproductiveUrge: 0 },
    genes: { color: 0, size: 1, speed: 1, health: 1, fertility: 1 },
    health: 100,
    age: 0,
    lastReproduction: 0,
    spawnedAt: 0,
    generation: 0,
    parentIds: [null, null],
    targetPosition: null,
    currentTarget: null,
    fleeTarget: null,
    biome: "forest",
    isDead: false,
    ...overrides,
  });

  const addAnimal = (animal: Animal): void => {
    (animalSystem as any).addAnimal(animal);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    batchMocks.batchIds = [];
    batchMocks.rebuildBuffers.mockClear();
    batchMocks.updateNeedsBatch.mockClear();
    batchMocks.updateAgesBatch.mockClear();
    batchMocks.syncToAnimals.mockClear();

    gameState = createMockGameState({
      animals: { animals: [] },
    });
    animalSystem = new AnimalSystem();
    
    // Create a real animals map for the mock registry
    const animalsMap = new Map<string, Animal>();
    
    // Manually initialize the properties that @postConstruct would set
    (animalSystem as any).gameState = gameState;
    (animalSystem as any).animalRegistry = {
      getAnimalsMap: () => animalsMap,
      registerAnimal: (animal: Animal) => { animalsMap.set(animal.id, animal); },
      unregisterAnimal: (id: string) => { animalsMap.delete(id); },
      getAnimal: (id: string) => animalsMap.get(id),
      hasAnimal: (id: string) => animalsMap.has(id),
      getAllAnimals: () => Array.from(animalsMap.values()),
      getAnimalCount: () => animalsMap.size,
      markDead: (id: string) => {
        const animal = animalsMap.get(id);
        if (animal) animal.isDead = true;
      },
      getAnimalsInRadius: (x: number, y: number, radius: number) => {
        return Array.from(animalsMap.values()).filter((a) => {
          const dx = a.position.x - x;
          const dy = a.position.y - y;
          return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
      },
      exportForGameState: () => ({
        animals: Array.from(animalsMap.values()),
        stats: {
          total: animalsMap.size,
          byType: {},
        },
      }),
      get size() { return animalsMap.size; },
    };
    (animalSystem as any).batchProcessor = {
      rebuildBuffers: batchMocks.rebuildBuffers,
      getAnimalIdArray: () => batchMocks.batchIds,
      updateNeedsBatch: batchMocks.updateNeedsBatch,
      updateAgesBatch: batchMocks.updateAgesBatch,
      syncToAnimals: batchMocks.syncToAnimals,
    };
    emitSpy = vi.spyOn(simulationEvents, "emit");
    updateNeedsSpy = vi.spyOn(AnimalNeeds, "updateNeeds");
    wanderSpy = vi.spyOn(AnimalBehavior, "wander").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    emitSpy.mockRestore();
    updateNeedsSpy.mockRestore();
    wanderSpy.mockRestore();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("addAnimal registra la criatura en el estado", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    const storedAnimals = (animalSystem as any).animals;
    expect(storedAnimals.size).toBe(1);
  });

  it("update aplica lógica individual cuando el conteo es bajo", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    vi.setSystemTime(2000);
    animalSystem.update(1000);

    expect(updateNeedsSpy).toHaveBeenCalled();
  });

  it("usa el procesador por lotes cuando hay muchos animales", () => {
    const animals: Animal[] = [];
    // BATCH_THRESHOLD es 100, así que necesitamos al menos 100 animales
    for (let i = 0; i < 100; i++) {
      const creature = createAnimal(`animal-${i}`);
      animals.push(creature);
      addAnimal(creature);
    }
    batchMocks.batchIds = animals.map((a) => a.id);

    vi.setSystemTime(2000);
    animalSystem.update(1000);

    expect(batchMocks.rebuildBuffers).toHaveBeenCalled();
    expect(batchMocks.updateNeedsBatch).toHaveBeenCalled();
    expect(batchMocks.syncToAnimals).toHaveBeenCalled();
  });

  it("killAnimal marca al animal como muerto y emite evento", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    (animalSystem as any).killAnimal("animal-1", "test");

    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.ANIMAL_DIED,
      expect.objectContaining({ animalId: "animal-1", cause: "test" }),
    );
  });
});
