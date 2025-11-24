import { describe, it, expect, beforeEach } from "vitest";
import { ItemGenerationSystem } from "../../src/simulation/systems/ItemGenerationSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ItemGenerationSystem", () => {
  let gameState: GameState;
  let itemGenerationSystem: ItemGenerationSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "zone-1",
          type: "work",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        },
      ],
    });
    itemGenerationSystem = new ItemGenerationSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(itemGenerationSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => itemGenerationSystem.update(1000)).not.toThrow();
    });
  });
});

