export type FoodCategory = "healthy" | "junk" | "dessert" | "drink" | "snack";

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
