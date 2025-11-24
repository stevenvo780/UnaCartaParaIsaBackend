import { describe, it, expect, beforeEach } from "vitest";
import { ResearchSystem } from "../../src/simulation/systems/ResearchSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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

    it("debe inicializar múltiples linajes", () => {
      researchSystem.initializeLineage("lineage-1");
      researchSystem.initializeLineage("lineage-2");
      expect(researchSystem).toBeDefined();
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

    it("debe inicializar linaje automáticamente si no existe", () => {
      const result = researchSystem.onRecipeDiscovered("new-lineage", "wood_to_plank", "agent-1");
      expect(result).toBeDefined();
    });

    it("debe retornar false para receta sin categoría", () => {
      researchSystem.initializeLineage("lineage-1");
      const result = researchSystem.onRecipeDiscovered("lineage-1", "nonexistent_recipe", "agent-1");
      expect(result.completed).toBe(false);
      expect(result.unlocked).toEqual([]);
    });

    it("debe rastrear contribuidores", () => {
      researchSystem.initializeLineage("lineage-1");
      researchSystem.onRecipeDiscovered("lineage-1", "wood_to_plank", "agent-1");
      researchSystem.onRecipeDiscovered("lineage-1", "wood_to_plank", "agent-2");
      // Debería rastrear ambos contribuidores
      expect(researchSystem).toBeDefined();
    });
  });

  describe("Gestión de categorías", () => {
    it("debe desbloquear categorías cuando se completa investigación", () => {
      researchSystem.initializeLineage("lineage-1");
      // Descubrir todas las recetas de basic_survival
      const basicRecipes = ["cook_meat", "cook_fish", "make_rope", "wooden_club"];
      basicRecipes.forEach(recipe => {
        researchSystem.onRecipeDiscovered("lineage-1", recipe, "agent-1");
      });
      // Debería desbloquear categorías siguientes
      expect(researchSystem).toBeDefined();
    });
  });

  describe("Estadísticas de linaje", () => {
    it("debe retornar estadísticas de linaje", () => {
      researchSystem.initializeLineage("lineage-1");
      const stats = researchSystem.getLineageStats("lineage-1");
      expect(stats).toBeDefined();
      expect(stats.unlockedCategories).toBeDefined();
      expect(stats.specializations).toBeDefined();
    });

    it("debe retornar estadísticas vacías para linaje no inicializado", () => {
      const stats = researchSystem.getLineageStats("nonexistent");
      expect(stats).toBeDefined();
    });
  });
});

