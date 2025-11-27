import { FoodCategory } from "../../../shared/constants/FoodEnums";

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
