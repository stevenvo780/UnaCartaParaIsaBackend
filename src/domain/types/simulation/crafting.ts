export type WeaponId = "wooden_club" | "stone_dagger";

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description?: string;
  output: { itemId: string; quantity: number };
  ingredients: CraftingIngredient[];
  craftingTime: number;
  successRate?: number;
  difficulty?: number;
  requirements?: {
    workstation?: string;
    skill?: string;
    skillLevel?: number;
    tool?: string;
  };
}

export interface CraftingJob {
  agentId: string;
  recipeId: string;
  startedAt: number;
  finishesAt: number;
  workstationId?: string;
}
