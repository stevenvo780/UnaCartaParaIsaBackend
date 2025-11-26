import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnimalNeeds } from "../../../src/domain/simulation/systems/animals/AnimalNeeds";
import type { Animal } from "../../../src/domain/types/simulation/animals";
import { getAnimalConfig } from "../../../src/infrastructure/services/world/config/AnimalConfigs";

// Mock del config
vi.mock("../../../src/infrastructure/services/world/config/AnimalConfigs", () => ({
  getAnimalConfig: vi.fn(),
}));

describe("AnimalNeeds", () => {
  let mockAnimal: Animal;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(100000); // Tiempo base para tests deterministas

    const now = Date.now();
    mockAnimal = {
      id: "test-animal-1",
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
        size: 1.0,
        speed: 1.0,
        health: 1.0,
        fertility: 1.0,
      },
      health: 100,
      age: 0,
      lastReproduction: now - 100000, // Hace 100 segundos
      spawnedAt: now,
      generation: 0,
      parentIds: [null, null],
      targetPosition: null,
      currentTarget: null,
      fleeTarget: null,
      biome: "grassland",
      isDead: false,
    };

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
      reproductionCooldown: 60000, // 60 segundos
      lifespan: 3600000,
      foodValue: 10,
      canBeHunted: true,
      fleeFromHumans: true,
      fleeDistance: 200,
      consumesVegetation: true,
      consumesWater: true,
      vegetationConsumptionRate: 1.0,
      waterConsumptionRate: 1.0,
      spawnProbability: 0.5,
      suitableBiomes: ["grassland"],
      groupSize: { min: 1, max: 3 },
      minDistanceBetweenGroups: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("updateNeeds", () => {
    it("debe aplicar decay de hunger basado en config", () => {
      mockAnimal.needs.hunger = 100;
      const initialHunger = mockAnimal.needs.hunger;

      AnimalNeeds.updateNeeds(mockAnimal, 10); // 10 minutos

      expect(mockAnimal.needs.hunger).toBeLessThan(initialHunger);
      expect(mockAnimal.needs.hunger).toBeGreaterThanOrEqual(0);
      // hungerDecayRate * deltaMinutes = 0.5 * 10 = 5
      expect(mockAnimal.needs.hunger).toBeCloseTo(100 - 5, 1);
    });

    it("debe aplicar decay de thirst basado en config", () => {
      mockAnimal.needs.thirst = 100;
      const initialThirst = mockAnimal.needs.thirst;

      AnimalNeeds.updateNeeds(mockAnimal, 10);

      expect(mockAnimal.needs.thirst).toBeLessThan(initialThirst);
      expect(mockAnimal.needs.thirst).toBeGreaterThanOrEqual(0);
      // thirstDecayRate * deltaMinutes = 0.3 * 10 = 3
      expect(mockAnimal.needs.thirst).toBeCloseTo(100 - 3, 1);
    });

    it("debe incrementar reproductiveUrge después de cooldown", () => {
      mockAnimal.needs.reproductiveUrge = 0;
      const now = Date.now();
      mockAnimal.lastReproduction = now - 70000; // Hace 70 segundos (> 60s cooldown)

      AnimalNeeds.updateNeeds(mockAnimal, 1); // 1 minuto

      expect(mockAnimal.needs.reproductiveUrge).toBeGreaterThan(0);
      // 5.0 * deltaMinutes = 5.0 * 1 = 5.0
      expect(mockAnimal.needs.reproductiveUrge).toBeCloseTo(5.0, 1);
    });

    it("no debe incrementar reproductiveUrge si no ha pasado el cooldown", () => {
      mockAnimal.needs.reproductiveUrge = 0;
      const now = Date.now();
      mockAnimal.lastReproduction = now - 30000; // Hace 30 segundos (< 60s cooldown)

      AnimalNeeds.updateNeeds(mockAnimal, 1);

      expect(mockAnimal.needs.reproductiveUrge).toBe(0);
    });

    it("debe aplicar decay de fear cuando no está fleeing", () => {
      mockAnimal.needs.fear = 50;
      mockAnimal.state = "idle";

      AnimalNeeds.updateNeeds(mockAnimal, 1);

      expect(mockAnimal.needs.fear).toBeLessThan(50);
      // 10 * deltaMinutes = 10 * 1 = 10
      expect(mockAnimal.needs.fear).toBeCloseTo(40, 1);
    });

    it("no debe aplicar decay de fear cuando está fleeing", () => {
      mockAnimal.needs.fear = 50;
      mockAnimal.state = "fleeing";

      AnimalNeeds.updateNeeds(mockAnimal, 1);

      expect(mockAnimal.needs.fear).toBe(50);
    });

    it("no debe hacer nada si no hay config", () => {
      vi.mocked(getAnimalConfig).mockReturnValue(undefined);
      const initialNeeds = { ...mockAnimal.needs };

      AnimalNeeds.updateNeeds(mockAnimal, 10);

      expect(mockAnimal.needs).toEqual(initialNeeds);
    });
  });

  describe("isStarving", () => {
    it("debe retornar true cuando hunger < 10", () => {
      mockAnimal.needs.hunger = 9;
      expect(AnimalNeeds.isStarving(mockAnimal)).toBe(true);
    });

    it("debe retornar false cuando hunger >= 10", () => {
      mockAnimal.needs.hunger = 10;
      expect(AnimalNeeds.isStarving(mockAnimal)).toBe(false);

      mockAnimal.needs.hunger = 50;
      expect(AnimalNeeds.isStarving(mockAnimal)).toBe(false);
    });
  });

  describe("isDehydrated", () => {
    it("debe retornar true cuando thirst < 10", () => {
      mockAnimal.needs.thirst = 9;
      expect(AnimalNeeds.isDehydrated(mockAnimal)).toBe(true);
    });

    it("debe retornar false cuando thirst >= 10", () => {
      mockAnimal.needs.thirst = 10;
      expect(AnimalNeeds.isDehydrated(mockAnimal)).toBe(false);

      mockAnimal.needs.thirst = 50;
      expect(AnimalNeeds.isDehydrated(mockAnimal)).toBe(false);
    });
  });

  describe("isCritical", () => {
    it("debe retornar true cuando starving", () => {
      mockAnimal.needs.hunger = 5;
      mockAnimal.needs.thirst = 50;
      expect(AnimalNeeds.isCritical(mockAnimal)).toBe(true);
    });

    it("debe retornar true cuando dehydrated", () => {
      mockAnimal.needs.hunger = 50;
      mockAnimal.needs.thirst = 5;
      expect(AnimalNeeds.isCritical(mockAnimal)).toBe(true);
    });

    it("debe retornar true cuando ambos starving y dehydrated", () => {
      mockAnimal.needs.hunger = 5;
      mockAnimal.needs.thirst = 5;
      expect(AnimalNeeds.isCritical(mockAnimal)).toBe(true);
    });

    it("debe retornar false cuando ninguno es crítico", () => {
      mockAnimal.needs.hunger = 50;
      mockAnimal.needs.thirst = 50;
      expect(AnimalNeeds.isCritical(mockAnimal)).toBe(false);
    });
  });

  describe("feed", () => {
    it("debe incrementar hunger con clamp a 100", () => {
      mockAnimal.needs.hunger = 50;

      AnimalNeeds.feed(mockAnimal, 30);

      expect(mockAnimal.needs.hunger).toBe(80);
    });

    it("debe clamp hunger a 100 cuando excede", () => {
      mockAnimal.needs.hunger = 90;

      AnimalNeeds.feed(mockAnimal, 30);

      expect(mockAnimal.needs.hunger).toBe(100);
    });

    it("debe funcionar desde 0", () => {
      mockAnimal.needs.hunger = 0;

      AnimalNeeds.feed(mockAnimal, 50);

      expect(mockAnimal.needs.hunger).toBe(50);
    });
  });

  describe("hydrate", () => {
    it("debe incrementar thirst con clamp a 100", () => {
      mockAnimal.needs.thirst = 50;

      AnimalNeeds.hydrate(mockAnimal, 30);

      expect(mockAnimal.needs.thirst).toBe(80);
    });

    it("debe clamp thirst a 100 cuando excede", () => {
      mockAnimal.needs.thirst = 90;

      AnimalNeeds.hydrate(mockAnimal, 30);

      expect(mockAnimal.needs.thirst).toBe(100);
    });

    it("debe funcionar desde 0", () => {
      mockAnimal.needs.thirst = 0;

      AnimalNeeds.hydrate(mockAnimal, 50);

      expect(mockAnimal.needs.thirst).toBe(50);
    });
  });

  describe("satisfyReproductiveUrge", () => {
    it("debe resetear urge y lastReproduction", () => {
      mockAnimal.needs.reproductiveUrge = 80;
      const beforeTime = Date.now();

      AnimalNeeds.satisfyReproductiveUrge(mockAnimal);

      const afterTime = Date.now();
      expect(mockAnimal.needs.reproductiveUrge).toBe(0);
      expect(mockAnimal.lastReproduction).toBeGreaterThanOrEqual(beforeTime);
      expect(mockAnimal.lastReproduction).toBeLessThanOrEqual(afterTime);
    });
  });
});

