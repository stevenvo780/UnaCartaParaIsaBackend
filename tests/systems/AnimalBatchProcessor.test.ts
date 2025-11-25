import { describe, it, expect, beforeEach } from "vitest";
import { AnimalBatchProcessor } from "../../src/domain/simulation/systems/AnimalBatchProcessor";
import type { Animal } from "../../src/domain/types/simulation/animals";

function createAnimal(id: string): Animal {
  return {
    id,
    type: "rabbit",
    position: { x: 0, y: 0 },
    state: "idle",
    needs: {
      hunger: 100,
      thirst: 100,
      fear: 0,
      reproductiveUrge: 0,
    },
    genes: {
      color: 0xffffff,
      size: 1,
      speed: 1,
      health: 1,
      fertility: 1,
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
  };
}

describe("AnimalBatchProcessor", () => {
  let processor: AnimalBatchProcessor;
  let animals: Map<string, Animal>;

  beforeEach(() => {
    processor = new AnimalBatchProcessor();
    animals = new Map();
    animals.set("a1", createAnimal("a1"));
    animals.set("a2", createAnimal("a2"));
    animals.get("a2")!.position = { x: 10, y: 5 };
    animals.get("a2")!.needs.hunger = 80;
  });

  it("debe reconstruir buffers correctamente", () => {
    processor.rebuildBuffers(animals);

    expect(processor.getPositionBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getNeedsBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getAnimalIdArray()).toHaveLength(2);
    expect(processor.isDirty()).toBe(false);
  });

  it("debe aplicar decay de necesidades en CPU fallback", () => {
    processor.rebuildBuffers(animals);

    const hungerRates = new Float32Array([1, 2]);
    const thirstRates = new Float32Array([0.5, 1]);
    processor.updateNeedsBatch(hungerRates, thirstRates, 1); // 1 minuto

    processor.syncToAnimals(animals);

    expect(animals.get("a1")!.needs.hunger).toBeLessThan(100);
    expect(animals.get("a2")!.needs.hunger).toBeLessThan(80);
    expect(processor.isDirty()).toBe(true);
  });

  it("debe sincronizar buffers con animales", () => {
    processor.rebuildBuffers(animals);
    const positionBuffer = processor.getPositionBuffer()!;
    positionBuffer[0] = 50;
    positionBuffer[1] = 60;

    const needsBuffer = processor.getNeedsBuffer()!;
    needsBuffer[0] = 10; // hambre
    needsBuffer[1] = 20; // sed
    needsBuffer[2] = 5; // miedo
    needsBuffer[3] = 15; // urge

    processor.syncToAnimals(animals);

    const updated = animals.get("a1")!;
    expect(updated.position).toEqual({ x: 50, y: 60 });
    expect(updated.needs.hunger).toBe(10);
    expect(updated.needs.thirst).toBe(20);
    expect(updated.needs.fear).toBe(5);
    expect(updated.needs.reproductiveUrge).toBe(15);
  });
});

