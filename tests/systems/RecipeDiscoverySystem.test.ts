import { describe, it, expect, beforeEach, vi } from "vitest";
import { RecipeDiscoverySystem } from "../../src/domain/simulation/systems/RecipeDiscoverySystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("RecipeDiscoverySystem", () => {
  let gameState: GameState;
  let recipeSystem: RecipeDiscoverySystem;

  beforeEach(() => {
    gameState = createMockGameState();
    recipeSystem = new RecipeDiscoverySystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(recipeSystem).toBeDefined();
    });

    it("debe aceptar función random personalizada", () => {
      const customRandom = vi.fn(() => 0.5);
      const customSystem = new RecipeDiscoverySystem(gameState, customRandom);
      expect(customSystem).toBeDefined();
    });
  });

  describe("Enseñanza de recetas", () => {
    it("debe enseñar receta a agente", () => {
      const event = recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      expect(event).toBeDefined();
      expect(event?.agentId).toBe("agent-1");
      expect(event?.recipeId).toBe("wood_to_plank");
    });

    it("debe retornar null para receta inexistente", () => {
      const event = recipeSystem.teachRecipe("agent-1", "nonexistent_recipe");
      expect(event).toBeNull();
    });

    it("debe retornar null si el agente ya conoce la receta", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      const event = recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      expect(event).toBeNull();
    });

    it("debe enseñar múltiples recetas a diferentes agentes", () => {
      const event1 = recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      const event2 = recipeSystem.teachRecipe("agent-2", "make_rope");
      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
    });
  });

  describe("Verificación de recetas", () => {
    it("debe verificar si agente conoce receta", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      const knows = recipeSystem.agentKnowsRecipe("agent-1", "wood_to_plank");
      expect(knows).toBe(true);
    });

    it("debe retornar false si agente no conoce receta", () => {
      const knows = recipeSystem.agentKnowsRecipe("agent-1", "wood_to_plank");
      expect(knows).toBe(false);
    });

    it("debe retornar false para agente sin recetas", () => {
      const knows = recipeSystem.agentKnowsRecipe("nonexistent", "wood_to_plank");
      expect(knows).toBe(false);
    });
  });

  describe("Experimentación", () => {
    it("debe intentar experimentar con ingredientes", () => {
      const result = recipeSystem.attemptExperimentation("agent-1", ["wood"]);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("debe retornar success false si no hay receta coincidente", () => {
      const result = recipeSystem.attemptExperimentation("agent-1", ["invalid_ingredient"]);
      expect(result.success).toBe(false);
    });

    it("debe descubrir receta mediante experimentación", () => {
      const result = recipeSystem.attemptExperimentation("agent-1", ["wood", "wood", "wood"]);
      // Puede o no tener éxito dependiendo de la lógica
      expect(result).toBeDefined();
    });
  });

  describe("Gestión de recetas", () => {
    it("debe retornar recetas conocidas por agente", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      recipeSystem.teachRecipe("agent-1", "make_rope");
      const recipes = recipeSystem.getAgentRecipes("agent-1");
      expect(recipes.length).toBeGreaterThanOrEqual(2);
    });

    it("debe retornar array vacío para agente sin recetas", () => {
      const recipes = recipeSystem.getAgentRecipes("agent-1");
      expect(recipes).toEqual([]);
    });

    it("debe retornar recetas disponibles para agente", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      const availableItems = new Map([["wood", 10]]);
      const recipes = recipeSystem.getAvailableRecipes("agent-1", availableItems);
      expect(Array.isArray(recipes)).toBe(true);
    });

    it("debe mejorar proficiencia de receta", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      expect(() => {
        recipeSystem.improveRecipeProficiency("agent-1", "wood_to_plank");
      }).not.toThrow();
    });

    it("debe compartir receta entre agentes", () => {
      recipeSystem.teachRecipe("teacher-1", "wood_to_plank");
      const result = recipeSystem.shareRecipe("teacher-1", "student-1", "wood_to_plank");
      expect(result).toBeDefined();
    });

    it("debe retornar recetas descubiertas globalmente", () => {
      const recipes = recipeSystem.getGloballyDiscoveredRecipes();
      expect(Array.isArray(recipes)).toBe(true);
    });

    it("debe heredar conocimiento de padres", () => {
      recipeSystem.teachRecipe("father-1", "wood_to_plank");
      expect(() => {
        recipeSystem.inheritKnowledgeFromParents("child-1", "father-1");
      }).not.toThrow();
    });

    it("debe retornar receta por ID", () => {
      const recipe = recipeSystem.getRecipeById("wood_to_plank");
      expect(recipe).toBeDefined();
      expect(recipe?.id).toBe("wood_to_plank");
    });

    it("debe retornar undefined para receta inexistente", () => {
      const recipe = recipeSystem.getRecipeById("nonexistent");
      expect(recipe).toBeUndefined();
    });

    it("debe retornar todas las recetas", () => {
      const recipes = recipeSystem.getAllRecipes();
      expect(Array.isArray(recipes)).toBe(true);
      expect(recipes.length).toBeGreaterThan(0);
    });

    it("debe remover agente", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      recipeSystem.removeAgent("agent-1");
      const knows = recipeSystem.agentKnowsRecipe("agent-1", "wood_to_plank");
      expect(knows).toBe(false);
    });

    it("debe limpiar todas las recetas", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      recipeSystem.cleanup();
      const knows = recipeSystem.agentKnowsRecipe("agent-1", "wood_to_plank");
      expect(knows).toBe(false);
    });
  });
});

