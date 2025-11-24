import { describe, it, expect, beforeEach } from "vitest";
import { AISystem } from "../../src/simulation/systems/AISystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("AISystem", () => {
  let gameState: GameState;
  let aiSystem: AISystem;

  beforeEach(() => {
    gameState = createMockGameState();
    aiSystem = new AISystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(aiSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => aiSystem.update(1000)).not.toThrow();
    });
  });
});

