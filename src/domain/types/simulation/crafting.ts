export {
  WeaponId,
  WorkstationType,
  SkillType,
  ToolType,
} from "../../../shared/constants/CraftingEnums";

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
    workstation?: WorkstationType;
    skill?: SkillType;
    skillLevel?: number;
    tool?: ToolType;
  };
  discoveredBy?: string[];
}

export interface CraftingJob {
  agentId: string;
  recipeId: string;
  startedAt: number;
  finishesAt: number;
  workstationId?: string;
}
