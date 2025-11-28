/**
 * Recipe type enumerations for the simulation system.
 *
 * Defines all recipe IDs used in the crafting system.
 *
 * @module shared/constants/RecipeEnums
 */

/**
 * Enumeration of recipe IDs.
 */
export enum RecipeId {
  WOOD_TO_PLANK = "wood_to_plank",
  MAKE_ROPE = "make_rope",
  STONE_AXE = "stone_axe",
  STONE_PICKAXE = "stone_pickaxe",
  WOODEN_CLUB = "wooden_club",
  STONE_DAGGER = "stone_dagger",

  SMELT_IRON = "smelt_iron",
  SMELT_COPPER = "smelt_copper",
  TAN_LEATHER = "tan_leather",
  WEAVE_CLOTH = "weave_cloth",
  FIRE_BRICK = "fire_brick",
  GRIND_WHEAT = "grind_wheat",

  BAKE_BREAD = "bake_bread",
  COOK_MEAT = "cook_meat",
  COOK_FISH = "cook_fish",
  MAKE_STEW = "make_stew",

  IRON_AXE = "iron_axe",
  IRON_PICKAXE = "iron_pickaxe",
  IRON_SWORD = "iron_sword",
  BOW = "bow",
  CLOTH_SHIRT = "cloth_shirt",
  LEATHER_VEST = "leather_vest",
  IRON_HELMET = "iron_helmet",

  WOODEN_FRAME = "wooden_frame",
  STONE_FOUNDATION = "stone_foundation",
  DOOR = "door",

  MYSTICAL_POTION = "mystical_potion",
  CRYSTAL_TOOL = "crystal_tool",
  ENERGY_CRYSTAL = "energy_crystal",
  SWAMP_ANTIDOTE = "swamp_antidote",
  REED_BASKET = "reed_basket",
  CLAY_POTTERY = "clay_pottery",
  MOUNTAIN_PICKAXE = "mountain_pickaxe",
  GEM_JEWELRY = "gem_jewelry",
  REINFORCED_ROPE = "reinforced_rope",
  HEALING_SALVE = "healing_salve",
  HONEY_BREAD = "honey_bread",
  PINE_TORCH = "pine_torch",
  COTTON_CLOTH = "cotton_cloth",
  FLOWER_DYE = "flower_dye",
  WHEAT_BEER = "wheat_beer",
  RECYCLED_TOOLS = "recycled_tools",
  CULTIVATED_SEEDS = "cultivated_seeds",
  COMMUNITY_MEAL = "community_meal",
}

/**
 * Type representing all possible recipe ID values.
 */
export type RecipeIdValue = `${RecipeId}`;

/**
 * Array of all recipe IDs for iteration.
 */
export const ALL_RECIPE_IDS: readonly RecipeId[] = Object.values(
  RecipeId,
) as RecipeId[];

/**
 * Type guard to check if a string is a valid RecipeId.
 */
export function isRecipeId(value: string): value is RecipeId {
  return Object.values(RecipeId).includes(value as RecipeId);
}
