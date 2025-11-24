import { describe, it, expect, beforeEach } from "vitest";
import { AnimalSystem } from "../../src/simulation/systems/AnimalSystem.js";
import { WorldResourceSystem } from "../../src/simulation/systems/WorldResourceSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("AnimalSystem", () => {
  let gameState: GameState;
  let worldResourceSystem: WorldResourceSystem;
  let animalSystem: AnimalSystem;

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
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => animalSystem.update(1000)).not.toThrow();
    });
  });
});

