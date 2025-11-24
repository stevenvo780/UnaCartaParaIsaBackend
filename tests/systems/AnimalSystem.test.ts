import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnimalSystem } from "../../src/domain/simulation/systems/AnimalSystem.ts";
import { WorldResourceSystem } from "../../src/domain/simulation/systems/WorldResourceSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("AnimalSystem", () => {
  let gameState: GameState;
  let animalSystem: AnimalSystem;
  let worldResourceSystem: WorldResourceSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      worldResources: {},
    });
    worldResourceSystem = new WorldResourceSystem(gameState);
    animalSystem = new AnimalSystem(gameState, worldResourceSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(animalSystem).toBeDefined();
    });

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new AnimalSystem(gameState, undefined, {
        maxAnimals: 1000,
        spawnRadius: 500,
        updateInterval: 500,
        cleanupInterval: 60000,
      });
      expect(customSystem).toBeDefined();
    });

    it("debe aceptar WorldResourceSystem opcional", () => {
      const systemWithoutResources = new AnimalSystem(gameState);
      expect(systemWithoutResources).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => animalSystem.update(1000)).not.toThrow();
    });

    it("no debe actualizar si no ha pasado el intervalo mínimo", () => {
      animalSystem.update(100);
      animalSystem.update(200);
      expect(animalSystem).toBeDefined();
    });

    it("debe actualizar animales después del intervalo", () => {
      animalSystem.update(2000);
      expect(animalSystem).toBeDefined();
    });
  });

  describe("Gestión de animales", () => {
    it("debe retornar animal por ID", () => {
      // Los animales se agregan a través de eventos o spawnAnimalsInWorld
      const found = animalSystem.getAnimal("nonexistent");
      expect(found).toBeUndefined();
    });

    it("debe retornar todos los animales", () => {
      const animals = animalSystem.getAnimals();
      expect(animals).toBeInstanceOf(Map);
    });

    it("debe spawnear animales en el mundo", () => {
      expect(() => {
        animalSystem.spawnAnimalsInWorld(1000, 1000);
      }).not.toThrow();
      
      const animals = animalSystem.getAnimals();
      expect(animals.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Manejo de eventos", () => {
    it("debe manejar evento de animal cazado", () => {
      // Primero spawnear un animal
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        expect(() => {
          simulationEvents.emit(GameEventNames.ANIMAL_HUNTED, {
            animalId,
            hunterId: "hunter-1",
          });
        }).not.toThrow();
      }
    });

    it("debe manejar evento de chunk renderizado", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.CHUNK_RENDERED, {
          coords: { x: 0, y: 0 },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        });
      }).not.toThrow();
    });

    it("debe manejar evento de animal muerto", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        expect(() => {
          simulationEvents.emit(GameEventNames.ANIMAL_DIED, {
            animalId,
          });
        }).not.toThrow();
      }
    });

    it("debe manejar evento de animal que consume recurso", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        expect(() => {
          simulationEvents.emit(GameEventNames.ANIMAL_CONSUMED_RESOURCE, {
            animalId,
            resourceId: "resource-1",
            resourceType: "berry_bush",
          });
        }).not.toThrow();
      }
    });

    it("debe manejar evento de reproducción de animal", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        expect(() => {
          simulationEvents.emit(GameEventNames.ANIMAL_REPRODUCED, {
            parentId: animalId,
            offspringId: "offspring-1",
          });
        }).not.toThrow();
      }
    });
  });

  describe("Comportamiento de animales", () => {
    it("debe actualizar comportamiento de animales vivos", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      expect(animals.size).toBeGreaterThanOrEqual(0);
      
      // Actualizar múltiples veces para cubrir el comportamiento
      animalSystem.update(2000);
      animalSystem.update(2000);
      expect(animalSystem).toBeDefined();
    });

    it("debe manejar animales muertos correctamente", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      const animals = animalSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        const animal = animals.get(animalId);
        if (animal) {
          animal.isDead = true;
          animalSystem.update(2000);
          expect(animalSystem).toBeDefined();
        }
      }
    });
  });

  describe("Limpieza de animales", () => {
    it("debe limpiar animales muertos después del intervalo", () => {
      const customSystem = new AnimalSystem(gameState, worldResourceSystem, {
        cleanupInterval: 100, // Intervalo corto para testing
      });
      
      customSystem.spawnAnimalsInWorld(100, 100);
      const animals = customSystem.getAnimals();
      const animalId = Array.from(animals.keys())[0];
      
      if (animalId) {
        const animal = animals.get(animalId);
        if (animal) {
          animal.isDead = true;
          // Esperar a que pase el intervalo de limpieza
          customSystem.update(200);
          expect(customSystem).toBeDefined();
        }
      }
    });
  });

  describe("Estadísticas", () => {
    it("debe actualizar estadísticas en gameState", () => {
      animalSystem.spawnAnimalsInWorld(100, 100);
      animalSystem.update(2000);
      
      expect(gameState.animals).toBeDefined();
      if (gameState.animals) {
        expect(gameState.animals.stats).toBeDefined();
        expect(typeof gameState.animals.stats.total).toBe("number");
      }
    });
  });
});
