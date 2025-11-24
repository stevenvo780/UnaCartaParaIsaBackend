import { describe, it, expect, beforeEach } from "vitest";
import { RoleSystem } from "../../src/simulation/systems/RoleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("RoleSystem", () => {
  let gameState: GameState;
  let roleSystem: RoleSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    roleSystem = new RoleSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(roleSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => roleSystem.update(1000)).not.toThrow();
    });
  });
});

