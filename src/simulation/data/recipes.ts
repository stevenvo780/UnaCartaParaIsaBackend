import type { CraftingRecipe } from "../types/crafting.js";

export const BASIC_RECIPES: CraftingRecipe[] = [
  {
    id: "wooden_club",
    name: "Garrote de madera",
    output: { itemId: "wooden_club", quantity: 1 },
    ingredients: [
      { itemId: "wood", quantity: 10 },
    ],
    craftingTime: 5_000,
    successRate: 0.95,
  },
  {
    id: "stone_dagger",
    name: "Daga de piedra",
    output: { itemId: "stone_dagger", quantity: 1 },
    ingredients: [
      { itemId: "stone", quantity: 8 },
    ],
    craftingTime: 7_000,
    successRate: 0.9,
  },
  {
    id: "water_ration",
    name: "Ración de agua",
    output: { itemId: "water", quantity: 3 },
    ingredients: [
      { itemId: "water", quantity: 1 },
    ],
    craftingTime: 2_000,
  },
];

export function getRecipeById(id: string): CraftingRecipe | undefined {
  return BASIC_RECIPES.find((recipe) => recipe.id === id);
}
