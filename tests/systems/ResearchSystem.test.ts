import { describe, it, expect, beforeEach } from "vitest";
import { ResearchSystem } from "../../src/simulation/systems/ResearchSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ResearchSystem", () => {
  let gameState: GameState;
  let researchSystem: ResearchSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    researchSystem = new ResearchSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(researchSystem).toBeDefined();
    });
  });

  describe("Inicialización de linajes", () => {
    it("debe inicializar linaje", () => {
      expect(() => researchSystem.initializeLineage("lineage-1")).not.toThrow();
    });
  });

  describe("Descubrimiento de recetas", () => {
    it("debe procesar descubrimiento de receta", () => {
      researchSystem.initializeLineage("lineage-1");
      const result = researchSystem.onRecipeDiscovered("lineage-1", "wood_to_plank", "agent-1");
      expect(result).toBeDefined();
      expect(result.completed).toBeDefined();
      expect(Array.isArray(result.unlocked)).toBe(true);
    });
  });
});

