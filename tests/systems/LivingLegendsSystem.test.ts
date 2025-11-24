import { describe, it, expect, beforeEach } from "vitest";
import { LivingLegendsSystem } from "../../src/simulation/systems/LivingLegendsSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("LivingLegendsSystem", () => {
  let gameState: GameState;
  let livingLegendsSystem: LivingLegendsSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    livingLegendsSystem = new LivingLegendsSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(livingLegendsSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => livingLegendsSystem.update(1000)).not.toThrow();
    });
  });
});

