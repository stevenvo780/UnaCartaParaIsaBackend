import { GameState } from "../../types/game-types";
import {
  AgentKnownRecipe,
  RecipeDiscoveryEvent,
} from "../../types/simulation/recipes";
import { CraftingRecipe } from "../../types/simulation/crafting";
import { RecipesCatalog } from "../../../simulation/data/RecipesCatalog";
import { BiomeRecipesCatalog } from "../../../simulation/data/BiomeRecipesCatalog";

const BASIC_RECIPES = [
  "wood_to_plank",
  "make_rope",
  "cook_meat",
  "cook_fish",
  "wooden_club",
];

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class RecipeDiscoverySystem {
  private gameState: GameState;
  private agentRecipes = new Map<string, Map<string, AgentKnownRecipe>>();
  private discoveredRecipes = new Set<string>();
  private biomeDiscoveries = new Map<string, Set<string>>();
  private random: () => number;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.random = Math.random;
    this.initializeBasicRecipes();
  }

  private initializeBasicRecipes(): void {
    BASIC_RECIPES.forEach((recipeId) => {
      this.discoveredRecipes.add(recipeId);
    });
  }

  /**
   * Attempts to discover a biome-specific recipe when an agent explores.
   * Biome recipes have a discovery chance based on time spent in the biome.
   *
   * @param agentId - Agent attempting the discovery
   * @param biomeType - Type of biome being explored
   * @returns Discovery event if successful, null otherwise
   */
  public attemptBiomeDiscovery(
    agentId: string,
    biomeType: string,
  ): RecipeDiscoveryEvent | null {
    const biomeRecipes = BiomeRecipesCatalog.getRecipesForBiome(biomeType);
    if (biomeRecipes.length === 0) return null;

    const unknownRecipes = biomeRecipes.filter(
      (recipe) => !this.agentKnowsRecipe(agentId, recipe.id),
    );
    if (unknownRecipes.length === 0) return null;

    if (this.random() > 0.1) return null;

    const recipe =
      unknownRecipes[Math.floor(this.random() * unknownRecipes.length)];

    RecipesCatalog.registerBiomeRecipe(recipe);

    const event = this.teachRecipe(agentId, recipe.id);
    if (event) {
      event.method = "exploration";

      if (!this.biomeDiscoveries.has(agentId)) {
        this.biomeDiscoveries.set(agentId, new Set());
      }
      this.biomeDiscoveries.get(agentId)!.add(recipe.id);
    }

    return event;
  }

  /**
   * Gets available recipes for a specific biome.
   *
   * @param biomeType - Type of biome
   * @returns Array of crafting recipes available in the biome
   */
  public getBiomeRecipes(biomeType: string): CraftingRecipe[] {
    return BiomeRecipesCatalog.getRecipesForBiome(biomeType);
  }

  /**
   * Gets all biomes that have special recipes.
   *
   * @returns Array of biome type strings
   */
  public getAvailableBiomes(): string[] {
    return BiomeRecipesCatalog.getAvailableBiomes();
  }

  public teachRecipe(
    agentId: string,
    recipeId: string,
  ): RecipeDiscoveryEvent | null {
    const recipe = RecipesCatalog.getRecipeById(recipeId);
    if (!recipe) return null;

    let agentRecipeMap = this.agentRecipes.get(agentId);
    if (!agentRecipeMap) {
      agentRecipeMap = new Map();
      this.agentRecipes.set(agentId, agentRecipeMap);
    }

    if (agentRecipeMap.has(recipeId)) return null;

    const knownRecipe: AgentKnownRecipe = {
      recipeId,
      discoveredAt: Date.now(),
      timesUsed: 0,
      successRate: recipe.successRate || 1.0,
      proficiency: 0,
    };

    agentRecipeMap.set(recipeId, knownRecipe);

    return {
      agentId,
      recipeId,
      method: "learning",
      discoveredAt: Date.now(),
    };
  }

  public attemptExperimentation(
    agentId: string,
    ingredients: string[],
    _currentBiome?: string,
  ): {
    success: boolean;
    recipeId?: string;
    duration: number;
    event?: RecipeDiscoveryEvent;
  } {
    const duration = 10000 + this.random() * 5000;

    const allRecipes = RecipesCatalog.getAllRecipes();
    const matchingRecipes = allRecipes.filter((recipe) => {
      const recipeIngredients = recipe.ingredients.map((i) => i.itemId).sort();
      const providedIngredients = [...ingredients].sort();

      return (
        recipeIngredients.length === providedIngredients.length &&
        recipeIngredients.every((ing, idx) => ing === providedIngredients[idx])
      );
    });

    if (matchingRecipes.length === 0) {
      return { success: false, duration };
    }

    const recipe = matchingRecipes[0];
    const alreadyKnown = this.agentKnowsRecipe(agentId, recipe.id);

    if (alreadyKnown) {
      return { success: false, duration };
    }

    const baseChance = Math.max(0.1, 1 - (recipe.difficulty || 1) / 15);
    const discoveryChance = Math.min(0.95, baseChance);

    const success = this.random() < discoveryChance;

    if (success) {
      const event = this.teachRecipe(agentId, recipe.id);
      this.discoveredRecipes.add(recipe.id);

      if (!recipe.discoveredBy) {
        recipe.discoveredBy = [];
      }
      recipe.discoveredBy.push(agentId);

      return {
        success: true,
        recipeId: recipe.id,
        duration,
        event: event || undefined,
      };
    }

    return { success: false, duration };
  }

  public agentKnowsRecipe(agentId: string, recipeId: string): boolean {
    const agentRecipeMap = this.agentRecipes.get(agentId);
    return agentRecipeMap?.has(recipeId) || false;
  }

  public getAgentRecipes(agentId: string): AgentKnownRecipe[] {
    const agentRecipeMap = this.agentRecipes.get(agentId);
    if (!agentRecipeMap) return [];
    return Array.from(agentRecipeMap.values());
  }

  public getAvailableRecipes(
    agentId: string,
    availableItems: Map<string, number>,
  ): CraftingRecipe[] {
    const knownRecipes = this.getAgentRecipes(agentId);
    const availableRecipes: CraftingRecipe[] = [];

    for (const knownRecipe of knownRecipes) {
      const recipe = RecipesCatalog.getRecipeById(knownRecipe.recipeId);
      if (!recipe) continue;

      const canCraft = recipe.ingredients.every((ingredient) => {
        const available = availableItems.get(ingredient.itemId) || 0;
        return available >= ingredient.quantity;
      });

      if (canCraft) {
        availableRecipes.push(recipe);
      }
    }

    return availableRecipes;
  }

  public improveRecipeProficiency(
    agentId: string,
    recipeId: string,
    success: boolean,
  ): void {
    const agentRecipeMap = this.agentRecipes.get(agentId);
    const knownRecipe = agentRecipeMap?.get(recipeId);

    if (!knownRecipe) return;

    knownRecipe.timesUsed++;

    if (success) {
      knownRecipe.proficiency = Math.min(
        100,
        knownRecipe.proficiency + 2 + this.random() * 3,
      );
      knownRecipe.successRate = Math.min(1.0, knownRecipe.successRate + 0.01);
    } else {
      knownRecipe.proficiency = Math.min(100, knownRecipe.proficiency + 0.5);
    }
  }

  public shareRecipe(
    teacherId: string,
    studentId: string,
    recipeId: string,
  ): RecipeDiscoveryEvent | null {
    if (!this.agentKnowsRecipe(teacherId, recipeId)) {
      return null;
    }

    const event = this.teachRecipe(studentId, recipeId);
    if (event) {
      event.method = "trade";
    }
    return event;
  }

  public getGloballyDiscoveredRecipes(): string[] {
    return Array.from(this.discoveredRecipes);
  }

  public inheritKnowledgeFromParents(
    childId: string,
    fatherId?: string,
    motherId?: string,
    inheritanceRate = 0.5,
  ): RecipeDiscoveryEvent[] {
    const events: RecipeDiscoveryEvent[] = [];

    const parents = [fatherId, motherId].filter(
      (id): id is string => id !== undefined,
    );

    if (parents.length === 0) return events;

    const parentRecipes = new Set<string>();

    parents.forEach((parentId) => {
      const parentKnownRecipes = this.getAgentRecipes(parentId);
      parentKnownRecipes.forEach((recipe) => {
        parentRecipes.add(recipe.recipeId);
      });
    });

    parentRecipes.forEach((recipeId) => {
      if (this.random() < inheritanceRate) {
        const event = this.teachRecipe(childId, recipeId);
        if (event) {
          events.push(event);
        }
      }
    });

    return events;
  }

  public getRecipeById(recipeId: string): CraftingRecipe | undefined {
    return RecipesCatalog.getRecipeById(recipeId) || undefined;
  }

  public getAllRecipes(): CraftingRecipe[] {
    return RecipesCatalog.getAllRecipes();
  }

  public update(): void {
    if (!this.gameState.recipes) {
      this.gameState.recipes = {
        discovered: [],
        agentRecipes: {},
      };
    }

    const discovered = this.getGloballyDiscoveredRecipes();
    this.gameState.recipes.discovered = discovered;
    this.gameState.recipes.globalDiscovered = discovered;

    const agentRecipesObj: Record<
      string,
      Array<{
        recipeId: string;
        discoveredAt: number;
        timesUsed: number;
        successRate: number;
        proficiency: number;
      }>
    > = {};

    this.agentRecipes.forEach((recipeMap, agentId) => {
      agentRecipesObj[agentId] = Array.from(recipeMap.values());
    });

    this.gameState.recipes.agentRecipes = agentRecipesObj;
  }

  public removeAgent(agentId: string): void {
    this.agentRecipes.delete(agentId);
  }

  public cleanup(): void {
    this.agentRecipes.clear();
  }
}
