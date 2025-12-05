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

// Alias/listas/guards eliminados para no exportar símbolos sin uso.
