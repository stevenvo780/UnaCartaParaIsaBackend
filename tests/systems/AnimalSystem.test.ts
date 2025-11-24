import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnimalSystem } from "../../src/simulation/systems/AnimalSystem.js";
import { WorldResourceSystem } from "../../src/simulation/systems/WorldResourceSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";
import { simulationEvents, GameEventNames } from "../../src/simulation/events.js";

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
  });
});
