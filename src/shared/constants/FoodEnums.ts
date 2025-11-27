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
 * Enumeration of food item IDs available in the simulation.
 * These IDs correspond to food items in the FoodCatalog.
 */
export enum FoodId {
  APPLE_PIE = "apple_pie",
  SALMON = "salmon",
  EGGSALAD = "eggsalad",
  BURGER = "burger",
  PIZZA = "pizza",
  HOTDOG = "hotdog",
  FRENCHFRIES = "frenchfries",
  CHOCOLATE_CAKE = "chocolate_cake",
  ICECREAM = "icecream",
  DONUT = "donut",
  POPCORN = "popcorn",
  COOKIES = "cookies",
  BREAD = "bread",
  SANDWICH = "sandwich",
}

/**
 * Type representing all possible food category values.
 */
export type FoodCategoryValue = `${FoodCategory}`;

/**
 * Type representing all possible food ID values.
 */
export type FoodIdValue = `${FoodId}`;

/**
 * Array of all food categories for iteration.
 */
export const ALL_FOOD_CATEGORIES: readonly FoodCategory[] = Object.values(
  FoodCategory,
) as FoodCategory[];

/**
 * Array of all food IDs for iteration.
 */
export const ALL_FOOD_IDS: readonly FoodId[] = Object.values(
  FoodId,
) as FoodId[];

/**
 * Type guard to check if a string is a valid FoodCategory.
 */
export function isFoodCategory(value: string): value is FoodCategory {
  return Object.values(FoodCategory).includes(value as FoodCategory);
}

/**
 * Type guard to check if a string is a valid FoodId.
 */
export function isFoodId(value: string): value is FoodId {
  return Object.values(FoodId).includes(value as FoodId);
}
