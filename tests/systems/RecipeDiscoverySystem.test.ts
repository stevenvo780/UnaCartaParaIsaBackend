import { describe, it, expect, beforeEach } from "vitest";
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
  });

  describe("Enseñanza de recetas", () => {
    it("debe enseñar receta a agente", () => {
      const event = recipeSystem.teachRecipe("agent-1", "wood_to_plank");
      expect(event).toBeDefined();
    });

    it("debe retornar null para receta inexistente", () => {
      const event = recipeSystem.teachRecipe("agent-1", "nonexistent_recipe");
      expect(event).toBeNull();
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
  });
});

