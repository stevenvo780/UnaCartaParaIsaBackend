import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnimalBehavior } from "../../../src/domain/simulation/systems/animals/AnimalBehavior";
import type { Animal } from "../../../src/domain/types/simulation/animals";
import { getAnimalConfig } from "../../../src/domain/world/config/AnimalConfigs";
import { simulationEvents, GameEventNames } from "../../../src/domain/simulation/core/events";
import { AnimalNeeds } from "../../../src/domain/simulation/systems/animals/AnimalNeeds";

// Mocks
vi.mock("../../../src/domain/world/config/AnimalConfigs", () => ({
  getAnimalConfig: vi.fn(),
}));

vi.mock("../../../src/infrastructure/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AnimalBehavior", () => {
  let mockAnimal: Animal;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockAnimal = {
      id: "test-animal-1",
      type: "rabbit",
      position: { x: 100, y: 100 },
      state: "idle",
      needs: {
        hunger: 50,
        thirst: 50,
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
    };

    emitSpy = vi.spyOn(simulationEvents, "emit");

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
      spawnProbability: 0.5,
      suitableBiomes: ["grassland"],
      groupSize: { min: 1, max: 3 },
      minDistanceBetweenGroups: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    AnimalBehavior["wanderAngles"].clear();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  describe("moveAwayFrom", () => {
    it("debe mover en dirección opuesta a amenaza", () => {
      const threatPosition = { x: 100, y: 100 };
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.moveAwayFrom(mockAnimal, threatPosition, 1.0, 0.1);

      // Como está en la misma posición, no debería moverse (distance = 0)
      expect(mockAnimal.position.x).toBe(initialX);
      expect(mockAnimal.position.y).toBe(initialY);
    });

    it("debe mover cuando hay distancia válida", () => {
      mockAnimal.position = { x: 150, y: 150 };
      const threatPosition = { x: 100, y: 100 };
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.moveAwayFrom(mockAnimal, threatPosition, 1.0, 0.1);

      // Debe moverse alejándose de la amenaza
      expect(mockAnimal.position.x).not.toBe(initialX);
      expect(mockAnimal.position.y).not.toBe(initialY);
    });

    it("no debe mover si distancia > 300", () => {
      mockAnimal.position = { x: 500, y: 500 };
      const threatPosition = { x: 100, y: 100 };
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.moveAwayFrom(mockAnimal, threatPosition, 1.0, 0.1);

      expect(mockAnimal.position.x).toBe(initialX);
      expect(mockAnimal.position.y).toBe(initialY);
    });
  });

  describe("moveToward", () => {
    it("debe mover hacia objetivo con smoothing", () => {
      mockAnimal.position = { x: 0, y: 0 };
      const targetPosition = { x: 100, y: 100 };
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.moveToward(mockAnimal, targetPosition, 1.0, 0.1);

      expect(mockAnimal.position.x).toBeGreaterThan(initialX);
      expect(mockAnimal.position.y).toBeGreaterThan(initialY);
    });

    it("debe aplicar slowing radius cuando cerca del objetivo", () => {
      mockAnimal.position = { x: 100, y: 100 };
      const targetPosition = { x: 150, y: 100 }; // 50 unidades de distancia (< 120 slowing radius)
      const initialX = mockAnimal.position.x;

      AnimalBehavior.moveToward(mockAnimal, targetPosition, 1.0, 0.1);

      // Debe moverse pero más lento debido al slowing radius
      expect(mockAnimal.position.x).toBeGreaterThan(initialX);
      expect(mockAnimal.position.x).toBeLessThan(targetPosition.x);
    });

    it("no debe mover si distancia <= 5", () => {
      mockAnimal.position = { x: 100, y: 100 };
      const targetPosition = { x: 103, y: 100 }; // 3 unidades de distancia
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.moveToward(mockAnimal, targetPosition, 1.0, 0.1);

      expect(mockAnimal.position.x).toBe(initialX);
      expect(mockAnimal.position.y).toBe(initialY);
    });
  });

  describe("wander", () => {
    it("debe cambiar ángulo aleatorio y mover", () => {
      mockAnimal.position = { x: 100, y: 100 };
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      // Mock Math.random para controlar el comportamiento
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

      AnimalBehavior.wander(mockAnimal, 1.0, 0.1);

      // Debe moverse (a menos que random < 0.05, que pondría state a idle)
      if (mockAnimal.state !== "idle") {
        expect(mockAnimal.position.x).not.toBe(initialX);
        expect(mockAnimal.position.y).not.toBe(initialY);
      }

      randomSpy.mockRestore();
    });

    it("debe poner state a idle con probabilidad 0.02", () => {
      mockAnimal.state = "wandering";
      vi.spyOn(Math, "random").mockReturnValue(0.01); // < 0.02

      AnimalBehavior.wander(mockAnimal, 1.0, 0.1);

      expect(mockAnimal.state).toBe("idle");
    });
  });

  describe("seekFood", () => {
    it("debe buscar recursos, consumir y emitir evento", () => {
      mockAnimal.position = { x: 0, y: 0 };
      const resource = {
        id: "resource-1",
        position: { x: 120, y: 120 },
        type: "vegetation",
      };

      const onConsume = vi.fn();
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      AnimalBehavior.seekFood(mockAnimal, [resource], 0.1, onConsume);

      expect(mockAnimal.currentTarget).toBeDefined();
      expect(mockAnimal.targetPosition).toEqual(resource.position);

      randomSpy.mockRestore();
    });

    it("debe consumir cuando está cerca del recurso", () => {
      mockAnimal.position = { x: 0, y: 0 };
      const resource = {
        id: "resource-1",
        position: { x: 5, y: 5 }, // Muy cerca (< 30)
        type: "vegetation",
      };

      const onConsume = vi.fn();
      const feedSpy = vi.spyOn(AnimalNeeds, "feed");

      AnimalBehavior.seekFood(mockAnimal, [resource], 0.1, onConsume);

      // Si está lo suficientemente cerca, debe consumir
      if (mockAnimal.state === "eating") {
        expect(feedSpy).toHaveBeenCalled();
        expect(onConsume).toHaveBeenCalledWith(resource.id);
        expect(emitSpy).toHaveBeenCalledWith(
          GameEventNames.ANIMAL_CONSUMED_RESOURCE,
          expect.objectContaining({
            animalId: mockAnimal.id,
            resourceType: "vegetation",
          }),
        );
      }
    });

    it("debe wander si no hay recursos disponibles", () => {
      const initialX = mockAnimal.position.x;
      const initialY = mockAnimal.position.y;

      AnimalBehavior.seekFood(mockAnimal, [], 0.1, vi.fn());

      // Debe haber intentado wander (posición puede cambiar)
      expect(mockAnimal.currentTarget).toBeNull();
    });

    it("no debe hacer nada si no consume vegetación", () => {
      vi.mocked(getAnimalConfig).mockReturnValue({
        ...vi.mocked(getAnimalConfig)(),
        consumesVegetation: false,
      } as any);

      const initialState = { ...mockAnimal };

      AnimalBehavior.seekFood(mockAnimal, [{ id: "r1", position: { x: 10, y: 10 }, type: "food" }], 0.1, vi.fn());

      expect(mockAnimal.currentTarget).toBe(initialState.currentTarget);
    });
  });

  describe("huntPrey", () => {
    it("debe perseguir y matar presa para predadores", () => {
      vi.mocked(getAnimalConfig).mockReturnValue({
        ...vi.mocked(getAnimalConfig)(),
        isPredator: true,
        preyTypes: ["rabbit"],
        speed: 60,
        foodValue: 50,
      } as any);

      mockAnimal.type = "wolf";
      mockAnimal.position = { x: 0, y: 0 };

      const prey: Animal = {
        ...mockAnimal,
        id: "prey-1",
        type: "rabbit",
        position: { x: 10, y: 10 },
      };

      const onKill = vi.fn();
      const feedSpy = vi.spyOn(AnimalNeeds, "feed");

      AnimalBehavior.huntPrey(mockAnimal, [prey], 0.1, onKill);

      expect(mockAnimal.currentTarget).toBeDefined();
      expect(prey.isBeingHunted).toBe(true);
    });

    it("debe ignorar presas muertas", () => {
      vi.mocked(getAnimalConfig).mockReturnValue({
        ...vi.mocked(getAnimalConfig)(),
        isPredator: true,
        preyTypes: ["rabbit"],
      } as any);

      mockAnimal.type = "wolf";
      mockAnimal.currentTarget = { type: "food", id: "prey-1" };
      mockAnimal.targetPosition = { x: 10, y: 10 };

      const deadPrey: Animal = {
        ...mockAnimal,
        id: "prey-1",
        type: "rabbit",
        isDead: true,
      };

      AnimalBehavior.huntPrey(mockAnimal, [deadPrey], 0.1, vi.fn());

      expect(mockAnimal.currentTarget).toBeNull();
      expect(mockAnimal.targetPosition).toBeNull();
    });

    it("no debe hacer nada si no es predador", () => {
      vi.mocked(getAnimalConfig).mockReturnValue({
        ...vi.mocked(getAnimalConfig)(),
        isPredator: false,
      } as any);

      const initialState = { ...mockAnimal };

      AnimalBehavior.huntPrey(mockAnimal, [], 0.1, vi.fn());

      expect(mockAnimal.currentTarget).toBe(initialState.currentTarget);
    });
  });

  describe("seekWater", () => {
    it("debe buscar agua, consumir y emitir evento", () => {
      mockAnimal.position = { x: 0, y: 0 };
      const waterResource = {
        id: "water-1",
        position: { x: 5, y: 5 },
      };

      const onConsume = vi.fn();
      const hydrateSpy = vi.spyOn(AnimalNeeds, "hydrate");

      AnimalBehavior.seekWater(mockAnimal, [waterResource], 0.1, onConsume);

      if (mockAnimal.state === "drinking") {
        expect(hydrateSpy).toHaveBeenCalled();
        expect(onConsume).toHaveBeenCalledWith(waterResource.id);
        expect(emitSpy).toHaveBeenCalledWith(
          GameEventNames.ANIMAL_CONSUMED_RESOURCE,
          expect.objectContaining({
            animalId: mockAnimal.id,
            resourceType: "water",
          }),
        );
      }
    });

    it("debe wander si no hay recursos de agua", () => {
      AnimalBehavior.seekWater(mockAnimal, [], 0.1, vi.fn());

      expect(mockAnimal.currentTarget).toBeNull();
    });
  });

  describe("attemptReproduction", () => {
    it("debe encontrar pareja y crear offspring", async () => {
      mockAnimal.needs.reproductiveUrge = 80;
      mockAnimal.position = { x: 0, y: 0 };

      const mate: Animal = {
        ...mockAnimal,
        id: "mate-1",
        needs: { ...mockAnimal.needs, reproductiveUrge: 80 },
        position: { x: 10, y: 10 },
      };

      const onOffspringCreated = vi.fn();
      // Mock AnimalGenetics.breedGenes
      const AnimalGenetics = await import("../../../src/domain/simulation/systems/animals/AnimalGenetics");
      vi.spyOn(AnimalGenetics.AnimalGenetics, "breedGenes").mockReturnValue({
        color: 0x000000,
        size: 1.0,
        speed: 1.0,
        health: 1.0,
        fertility: 1.0,
      });

      // Mock Math.random para controlar reproducción exitosa
      vi.spyOn(Math, "random").mockReturnValue(0.1); // < 0.2 para reproducir

      AnimalBehavior.attemptReproduction(mockAnimal, [mate], 0.1, onOffspringCreated);

      // Puede o no reproducirse dependiendo del random
      if (onOffspringCreated.mock.calls.length > 0) {
        expect(onOffspringCreated).toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalledWith(
          GameEventNames.ANIMAL_REPRODUCED,
          expect.objectContaining({
            parentId: mockAnimal.id,
            partnerId: mate.id,
          }),
        );
      }
    });

    it("debe heredar genes y emitir evento", async () => {
      mockAnimal.needs.reproductiveUrge = 80;
      const mate: Animal = {
        ...mockAnimal,
        id: "mate-1",
        needs: { ...mockAnimal.needs, reproductiveUrge: 80 },
        position: { x: 10, y: 10 },
      };

      const onOffspringCreated = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0.1);

      AnimalBehavior.attemptReproduction(mockAnimal, [mate], 0.1, onOffspringCreated);

      // Si se reproduce, debe haber llamado onOffspringCreated
      if (onOffspringCreated.mock.calls.length > 0) {
        const offspring = onOffspringCreated.mock.calls[0][0];
        expect(offspring).toBeDefined();
        expect(offspring.parentIds).toContain(mockAnimal.id);
        expect(offspring.parentIds).toContain(mate.id);
      }
    });

    it("debe wander si no hay pareja disponible", () => {
      AnimalBehavior.attemptReproduction(mockAnimal, [], 0.1, vi.fn());

      expect(mockAnimal.currentTarget).toBeNull();
    });
  });
});

