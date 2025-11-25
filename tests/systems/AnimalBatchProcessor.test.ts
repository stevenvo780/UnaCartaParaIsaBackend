import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Animal } from "../../src/domain/types/simulation/animals";
import { AnimalBatchProcessor } from "../../src/domain/simulation/systems/AnimalBatchProcessor";

const createAnimal = (id: string, overrides: Partial<Animal> = {}): Animal => ({
  id,
  type: "rabbit",
  position: { x: 0, y: 0 },
  state: "idle",
  needs: { hunger: 80, thirst: 70, fear: 10, reproductiveUrge: 5 },
  genes: { color: 0, size: 1, speed: 1, health: 1, fertility: 1 },
  health: 100,
  age: 1,
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

describe("AnimalBatchProcessor", () => {
  let animals: Map<string, Animal>;
  let processor: AnimalBatchProcessor;

  beforeEach(() => {
    animals = new Map([
      ["a1", createAnimal("a1", { position: { x: 10, y: 20 } })],
      ["a2", createAnimal("a2", { position: { x: 30, y: 40 }, needs: { hunger: 90, thirst: 50, fear: 20, reproductiveUrge: 15 }, age: 5 })],
    ]);
    processor = new AnimalBatchProcessor();
  });

  it("rebuildBuffers llena los buffers con datos de animales", () => {
    processor.rebuildBuffers(animals);

    const positions = processor.getPositionBuffer();
    const needs = processor.getNeedsBuffer();
    const ids = processor.getAnimalIdArray();

    expect(positions).toBeInstanceOf(Float32Array);
    expect(positions).toEqual(new Float32Array([10, 20, 30, 40]));
    expect(needs).toEqual(
      new Float32Array([
        80, 70, 10, 5,
        90, 50, 20, 15,
      ]),
    );
    expect(ids).toEqual(["a1", "a2"]);
    expect(processor.isDirty()).toBe(false);
  });

  it("rebuildBuffers limpia buffers cuando no hay animales", () => {
    processor.rebuildBuffers(new Map());
    expect(processor.getPositionBuffer()).toBeNull();
    expect(processor.getNeedsBuffer()).toBeNull();
    expect(processor.getAnimalIdArray()).toEqual([]);
    expect(processor.isDirty()).toBe(false);
  });

  it("updateNeedsBatch reduce hunger/thirst y marca buffers como dirty", () => {
    processor.rebuildBuffers(animals);
    const hungerRates = new Float32Array([1, 2]);
    const thirstRates = new Float32Array([0.5, 1.5]);

    processor.updateNeedsBatch(hungerRates, thirstRates, 1);

    const needs = processor.getNeedsBuffer();
    expect(needs).toEqual(
      new Float32Array([
        79, 69.5, 9.5, 5,
        88, 48.5, 19.5, 15,
      ]),
    );
    expect(processor.isDirty()).toBe(true);
  });

  it("updateNeedsBatch usa GPU cuando está disponible", () => {
    const gpuService = {
      isGPUAvailable: () => true,
      applyNeedsDecayBatch: vi.fn(() => new Float32Array([
        70, 60, 9, 5,
        85, 45, 18, 14,
      ])),
    } as any;
    processor = new AnimalBatchProcessor(gpuService);
    processor.rebuildBuffers(animals);

    const hungerRates = new Float32Array([1, 1]);
    const thirstRates = new Float32Array([1, 1]);
    processor.updateNeedsBatch(hungerRates, thirstRates, 1);

    expect(gpuService.applyNeedsDecayBatch).toHaveBeenCalled();
    expect(processor.getNeedsBuffer()).toEqual(
      new Float32Array([
        69, 59, 9, 5,
        84, 44, 18, 14,
      ]),
    );
    expect(processor.isDirty()).toBe(true);
  });

  it("updateAgesBatch incrementa edades y marca dirty", () => {
    processor.rebuildBuffers(animals);
    processor.updateAgesBatch(2);

    const ageBuffer = (processor as any).ageBuffer as Float32Array;
    expect(Array.from(ageBuffer)).toEqual([3, 7]);
    expect(processor.isDirty()).toBe(true);
  });

  it("syncToAnimals copia buffers de vuelta al mapa", () => {
    processor.rebuildBuffers(animals);

    // Simular actualizaciones de GPU/CPU
    const positionBuffer = (processor as any).positionBuffer as Float32Array;
    const needsBuffer = (processor as any).needsBuffer as Float32Array;
    const ageBuffer = (processor as any).ageBuffer as Float32Array;
    const healthBuffer = (processor as any).healthBuffer as Float32Array;

    positionBuffer.set([50, 60, 70, 80]);
    needsBuffer.set([
      10, 20, 30, 40,
      50, 60, 70, 80,
    ]);
    ageBuffer.set([11, 22]);
    healthBuffer.set([55, 44]);

    processor.syncToAnimals(animals);

    const first = animals.get("a1");
    const second = animals.get("a2");

    expect(first?.position).toEqual({ x: 50, y: 60 });
    expect(first?.needs).toEqual({ hunger: 10, thirst: 20, fear: 30, reproductiveUrge: 40 });
    expect(first?.age).toBe(11);
    expect(first?.health).toBe(55);

    expect(second?.position).toEqual({ x: 70, y: 80 });
    expect(second?.needs).toEqual({ hunger: 50, thirst: 60, fear: 70, reproductiveUrge: 80 });
    expect(second?.age).toBe(22);
    expect(second?.health).toBe(44);
  });
});
