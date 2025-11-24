export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: Array<{
    itemId: string;
    quantity: number;
  }>;
  outputs: Array<{
    itemId: string;
    quantity: number;
  }>;
  difficulty: number;
  successRate: number;
  craftingTime: number;
  category?: string;
  discoveredBy?: string[];
}

export interface AgentKnownRecipe {
  recipeId: string;
  discoveredAt: number;
  timesUsed: number;
  successRate: number;
  proficiency: number;
}

export interface RecipeDiscoveryEvent {
  agentId: string;
  recipeId: string;
  method: "learning" | "experimentation" | "trade";
  ingredients?: string[];
  discoveredAt: number;
}

export interface ActiveExperiment {
  agentId: string;
  ingredients: string[];
  startTime: number;
  duration: number;
}
