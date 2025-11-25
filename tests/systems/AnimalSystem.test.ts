import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import type { Animal } from "../../src/domain/types/simulation/animals";
import { AnimalSystem } from "../../src/domain/simulation/systems/AnimalSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

const mockUpdateNeeds = vi.fn();
const mockWander = vi.fn();
const mockRebuildBuffers = vi.fn();
const mockUpdateNeedsBatch = vi.fn();
const mockUpdateAgesBatch = vi.fn();
const mockSync = vi.fn();
let batchIds: string[] = [];

vi.mock("../../src/domain/simulation/systems/animals/AnimalNeeds", () => ({
  AnimalNeeds: {
    updateNeeds: mockUpdateNeeds,
    feed: vi.fn(),
    hydrate: vi.fn(),
    satisfyReproductiveUrge: vi.fn(),
  },
}));

vi.mock("../../src/domain/simulation/systems/animals/AnimalBehavior", () => ({
  AnimalBehavior: {
    moveAwayFrom: vi.fn(),
    seekFood: vi.fn(),
    seekWater: vi.fn(),
    attemptReproduction: vi.fn(),
    huntPrey: vi.fn(),
    wander: mockWander,
  },
}));

vi.mock("../../src/domain/simulation/systems/AnimalBatchProcessor", () => ({
  AnimalBatchProcessor: class {
    rebuildBuffers = mockRebuildBuffers;
    getAnimalIdArray = () => batchIds;
    updateNeedsBatch = mockUpdateNeedsBatch;
    updateAgesBatch = mockUpdateAgesBatch;
    syncToAnimals = mockSync;
  },
}));

vi.mock("../../src/infrastructure/services/world/config/AnimalConfigs", () => ({
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

describe("AnimalSystem", () => {
  let gameState: GameState;
  let animalSystem: AnimalSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

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
    gameState = createMockGameState({
      animals: { animals: [] },
    });
    animalSystem = new AnimalSystem(gameState);
    emitSpy = vi.spyOn(simulationEvents, "emit");
    batchIds = [];
    mockUpdateNeeds.mockClear();
    mockWander.mockClear();
    mockRebuildBuffers.mockClear();
    mockUpdateNeedsBatch.mockClear();
    mockUpdateAgesBatch.mockClear();
    mockSync.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("addAnimal registra la criatura en el estado", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    expect(gameState.animals?.animals.length).toBe(1);
  });

  it("update aplica lógica individual cuando el conteo es bajo", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    vi.setSystemTime(2000);
    animalSystem.update(1000);

    expect(mockUpdateNeeds).toHaveBeenCalled();
    expect(mockWander).toHaveBeenCalled();
  });

  it("usa el procesador por lotes cuando hay muchos animales", () => {
    const animals: Animal[] = [];
    for (let i = 0; i < 35; i++) {
      const creature = createAnimal(`animal-${i}`);
      animals.push(creature);
      addAnimal(creature);
    }
    batchIds = animals.map((a) => a.id);

    vi.setSystemTime(2000);
    animalSystem.update(1000);

    expect(mockRebuildBuffers).toHaveBeenCalled();
    expect(mockUpdateNeedsBatch).toHaveBeenCalled();
    expect(mockSync).toHaveBeenCalled();
  });

  it("killAnimal marca al animal como muerto y emite evento", () => {
    const animal = createAnimal("animal-1");
    addAnimal(animal);

    (animalSystem as any).killAnimal("animal-1", "test");

    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.ANIMAL_DIED,
      expect.objectContaining({ animalId: "animal-1", reason: "test" }),
    );
  });
});
