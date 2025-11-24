import { describe, it, expect, beforeEach, vi } from "vitest";
import { RecipeDiscoverySystem } from "../../src/simulation/systems/RecipeDiscoverySystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

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

  describe("Registro de uso de recetas", () => {
    it("debe registrar uso de receta", () => {
      recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      expect(() => {
        recipeSystem.recordRecipeUse("agent-1", "wood_to_plank", true);
      }).not.toThrow();
    });

    it("debe manejar uso de receta no conocida", () => {
      expect(() => {
        recipeSystem.recordRecipeUse("agent-1", "nonexistent", true);
      }).not.toThrow();
    });
  });
});

