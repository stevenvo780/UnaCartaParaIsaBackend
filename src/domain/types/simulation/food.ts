import { FoodCategory } from "../../../shared/constants/FoodEnums";

// Re-export FoodCategory enum for backward compatibility
export { FoodCategory };

export interface FoodItem {
  id: string;
  name: string;
  sprite: string;
  category: FoodCategory;
  hungerRestore: number;
  happinessBonus: number;
  energyEffect: number;
  healthEffect: number;
  price: number;
  consumeTime: number;
  spoilTime?: number;
  description: string;
}
