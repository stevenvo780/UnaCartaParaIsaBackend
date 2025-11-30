import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Animal } from "../../src/domain/types/simulation/animals";
import { AnimalBatchProcessor } from "../../src/domain/simulation/systems/animals/AnimalBatchProcessor";

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
    // Buffers now have 10% extra capacity, so we check first N elements
    expect(positions!.slice(0, 4)).toEqual(new Float32Array([10, 20, 30, 40]));
    expect(needs!.slice(0, 8)).toEqual(
      new Float32Array([
        80, 70, 10, 5,
        90, 50, 20, 15,
      ]),
    );
    // animalIdArray may have extra capacity, check first 2 elements
    expect(ids.slice(0, 2)).toEqual(["a1", "a2"]);
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
    // La implementación usa solo el primer valor del array como tasa base
    // hungerRate = hungerRates[0] || 1.0 / 60 = 1.0 / 60 por minuto
    // thirstRate = thirstRates[0] || 1.5 / 60 = 1.5 / 60 por minuto
    // fearDecayRate = 0.5 / 60 por minuto
    // Para deltaMinutes = 1:
    // Animal 1: hunger 80 - (1.0/60 * 1) = 80 - 0.0166... ≈ 79.983, pero Math.max(0, ...) = 79.983
    //           thirst 70 - (1.5/60 * 1) = 70 - 0.025 = 69.975
    //           fear 10 - (0.5/60 * 1) = 10 - 0.0083... ≈ 9.9916
    const hungerRates = new Float32Array([1.0 / 60, 2.0 / 60]);
    const thirstRates = new Float32Array([1.5 / 60, 1.5 / 60]);

    processor.updateNeedsBatch(hungerRates, thirstRates, 1);

    const needs = processor.getNeedsBuffer();
    // Verificar que los valores se redujeron correctamente
    expect(needs![0]).toBeCloseTo(80 - 1.0 / 60, 2); // hunger animal 1
    expect(needs![1]).toBeCloseTo(70 - 1.5 / 60, 2); // thirst animal 1
    expect(needs![2]).toBeCloseTo(10 - 0.5 / 60, 2); // fear animal 1
    expect(needs![3]).toBe(5); // reproductiveUrge no cambia
    expect(needs![4]).toBeCloseTo(90 - 2.0 / 60, 2); // hunger animal 2
    expect(needs![5]).toBeCloseTo(50 - 1.5 / 60, 2); // thirst animal 2
    expect(needs![6]).toBeCloseTo(20 - 0.5 / 60, 2); // fear animal 2
    expect(needs![7]).toBe(15); // reproductiveUrge no cambia
    expect(processor.isDirty()).toBe(true);
  });

  it("updateAgesBatch incrementa edades y marca dirty", () => {
    processor.rebuildBuffers(animals);
    processor.updateAgesBatch(2);

    const ageBuffer = (processor as any).ageBuffer as Float32Array;
    // Buffer may have extra capacity, check first 2 elements
    expect(Array.from(ageBuffer.slice(0, 2))).toEqual([3, 7]);
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
