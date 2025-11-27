/**
 * Food type enumerations for the simulation system.
 *
 * Defines all food categories used in the simulation.
 *
 * @module shared/constants/FoodEnums
 */

/**
 * Enumeration of food categories.
 */
export enum FoodCategory {
  HEALTHY = "healthy",
  JUNK = "junk",
  DESSERT = "dessert",
  DRINK = "drink",
  SNACK = "snack",
}

/**
 * Type representing all possible food category values.
 */
export type FoodCategoryValue = `${FoodCategory}`;

/**
 * Array of all food categories for iteration.
 */
export const ALL_FOOD_CATEGORIES: readonly FoodCategory[] = Object.values(
  FoodCategory,
) as FoodCategory[];

/**
 * Type guard to check if a string is a valid FoodCategory.
 */
export function isFoodCategory(value: string): value is FoodCategory {
  return Object.values(FoodCategory).includes(value as FoodCategory);
}
