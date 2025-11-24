import { GameState } from "../../types/game-types.js";
import {
  CraftingRecipe,
  AgentKnownRecipe,
  RecipeDiscoveryEvent,
} from "../types/recipes.js";

// Simplified catalog - in production would be loaded from data files
const RECIPES_CATALOG: CraftingRecipe[] = [
  {
    id: "wood_to_plank",
    name: "Wood Plank",
    description: "Convert wood into planks",
    ingredients: [{ itemId: "wood", quantity: 2 }],
    outputs: [{ itemId: "plank", quantity: 4 }],
    difficulty: 1,
    successRate: 0.9,
    craftingTime: 5000,
    category: "woodworking",
  },
  {
    id: "make_rope",
    name: "Rope",
    description: "Make rope from plant fibers",
    ingredients: [{ itemId: "fiber", quantity: 3 }],
    outputs: [{ itemId: "rope", quantity: 1 }],
    difficulty: 1,
    successRate: 0.85,
    craftingTime: 3000,
    category: "basic_survival",
  },
  {
    id: "cook_meat",
    name: "Cooked Meat",
    description: "Cook raw meat",
    ingredients: [{ itemId: "raw_meat", quantity: 1 }],
    outputs: [{ itemId: "cooked_meat", quantity: 1 }],
    difficulty: 1,
    successRate: 0.8,
    craftingTime: 4000,
    category: "basic_survival",
  },
  {
    id: "cook_fish",
    name: "Cooked Fish",
    description: "Cook raw fish",
    ingredients: [{ itemId: "raw_fish", quantity: 1 }],
    outputs: [{ itemId: "cooked_fish", quantity: 1 }],
    difficulty: 1,
    successRate: 0.8,
    craftingTime: 4000,
    category: "basic_survival",
  },
  {
    id: "wooden_club",
    name: "Wooden Club",
    description: "A simple wooden weapon",
    ingredients: [{ itemId: "wood", quantity: 3 }],
    outputs: [{ itemId: "wooden_club", quantity: 1 }],
    difficulty: 2,
    successRate: 0.75,
    craftingTime: 6000,
    category: "basic_survival",
  },
];

const BASIC_RECIPES = [
  "wood_to_plank",
  "make_rope",
  "cook_meat",
  "cook_fish",
  "wooden_club",
];

export class RecipeDiscoverySystem {
  private gameState: GameState;
  private agentRecipes = new Map<string, Map<string, AgentKnownRecipe>>();
  private discoveredRecipes = new Set<string>();
  private random: () => number;

  constructor(gameState: GameState, randomFn?: () => number) {
    this.gameState = gameState;
    this.random = randomFn || Math.random;
    this.initializeBasicRecipes();
  }

  private initializeBasicRecipes(): void {
    BASIC_RECIPES.forEach((recipeId) => {
      this.discoveredRecipes.add(recipeId);
    });
  }

  public teachRecipe(agentId: string, recipeId: string): RecipeDiscoveryEvent | null {
    const recipe = RECIPES_CATALOG.find((r) => r.id === recipeId);
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
      successRate: recipe.successRate,
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
    _currentBiome?: string
  ): {
    success: boolean;
    recipeId?: string;
    duration: number;
    event?: RecipeDiscoveryEvent;
  } {
    const duration = 10000 + this.random() * 5000;

    const matchingRecipes = RECIPES_CATALOG.filter((recipe) => {
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

    const baseChance = Math.max(0.1, 1 - recipe.difficulty / 15);
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
    availableItems: Map<string, number>
  ): CraftingRecipe[] {
    const knownRecipes = this.getAgentRecipes(agentId);
    const availableRecipes: CraftingRecipe[] = [];

    for (const knownRecipe of knownRecipes) {
      const recipe = RECIPES_CATALOG.find((r) => r.id === knownRecipe.recipeId);
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
    success: boolean
  ): void {
    const agentRecipeMap = this.agentRecipes.get(agentId);
    const knownRecipe = agentRecipeMap?.get(recipeId);

    if (!knownRecipe) return;

    knownRecipe.timesUsed++;

    if (success) {
      knownRecipe.proficiency = Math.min(
        100,
        knownRecipe.proficiency + 2 + this.random() * 3
      );
      knownRecipe.successRate = Math.min(1.0, knownRecipe.successRate + 0.01);
    } else {
      knownRecipe.proficiency = Math.min(100, knownRecipe.proficiency + 0.5);
    }
  }

  public shareRecipe(
    teacherId: string,
    studentId: string,
    recipeId: string
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
    inheritanceRate = 0.5
  ): RecipeDiscoveryEvent[] {
    const events: RecipeDiscoveryEvent[] = [];

    const parents = [fatherId, motherId].filter(
      (id): id is string => id !== undefined
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
    return RECIPES_CATALOG.find((r) => r.id === recipeId);
  }

  public getAllRecipes(): CraftingRecipe[] {
    return [...RECIPES_CATALOG];
  }

  public removeAgent(agentId: string): void {
    this.agentRecipes.delete(agentId);
  }

  public cleanup(): void {
    this.agentRecipes.clear();
  }
}
