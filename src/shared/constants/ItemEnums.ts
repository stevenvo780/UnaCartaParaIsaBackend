/**
 * Item type enumerations for the simulation system.
 *
 * Defines all item rarity levels and tiers used in item generation.
 *
 * @module shared/constants/ItemEnums
 */

/**
 * Enumeration of item rarity levels.
 */
export enum ItemRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

/**
 * Enumeration of item tiers.
 * Defines the processing level or category of items.
 */
export enum ItemTier {
  RAW = "raw",
  PROCESSED = "processed",
  CRAFTABLE = "craftable",
  SPECIAL = "special",
}

/**
 * Enumeration of item categories.
 * Defines the broad category classification of items.
 */
export enum ItemCategory {
  MATERIAL = "material",
  FOOD = "food",
  TOOL = "tool",
  WEAPON = "weapon",
  ARMOR = "armor",
  STRUCTURE = "structure",
  CONSUMABLE = "consumable",
  TRADE = "trade",
  SPECIAL = "special",
}

/**
 * Enumeration of all item IDs used in the simulation.
 * This is the single source of truth for all item identifiers.
 */
export enum ItemId {
  // Raw Materials
  WOOD_LOG = "wood_log",
  FIBER = "fiber",
  STONE = "stone",
  IRON_ORE = "iron_ore",
  COPPER_ORE = "copper_ore",
  CLAY = "clay",
  WHEAT = "wheat",
  BERRIES = "berries",
  RAW_MEAT = "raw_meat",
  FISH = "fish",
  WATER = "water",
  LEATHER_HIDE = "leather_hide",
  COAL = "coal",
  MUSHROOM_MYSTICAL = "mushroom_mystical",
  GLOWING_CRYSTAL = "glowing_crystal",
  MYSTICAL_FIBER = "mystical_fiber",
  SWAMP_HERB = "swamp_herb",
  REEDS = "reeds",
  MOUNTAIN_WOOD = "mountain_wood",
  RARE_GEMS = "rare_gems",
  MEDICINAL_HERBS = "medicinal_herbs",
  HONEY = "honey",
  PINE_RESIN = "pine_resin",
  COTTON = "cotton",
  WILDFLOWERS = "wildflowers",
  SCRAP_METAL = "scrap_metal",
  OLD_TOOLS = "old_tools",
  SEEDS = "seeds",

  // Processed Materials
  PLANK = "plank",
  IRON_INGOT = "iron_ingot",
  COPPER_INGOT = "copper_ingot",
  LEATHER = "leather",
  CLOTH = "cloth",
  ROPE = "rope",
  BRICK = "brick",
  FLOUR = "flour",
  BREAD = "bread",
  COOKED_MEAT = "cooked_meat",
  COOKED_FISH = "cooked_fish",
  MEAT_STEW = "meat_stew",

  // Tools & Weapons
  STONE_AXE = "stone_axe",
  STONE_PICKAXE = "stone_pickaxe",
  IRON_AXE = "iron_axe",
  IRON_PICKAXE = "iron_pickaxe",
  WOODEN_CLUB = "wooden_club",
  STONE_DAGGER = "stone_dagger",
  IRON_SWORD = "iron_sword",
  BOW = "bow",

  // Armor
  CLOTH_SHIRT = "cloth_shirt",
  LEATHER_VEST = "leather_vest",
  IRON_HELMET = "iron_helmet",

  // Structures
  WOODEN_FRAME = "wooden_frame",
  STONE_FOUNDATION = "stone_foundation",
  DOOR = "door",

  // Crafting Stations
  ANVIL = "anvil",
  SMITHING = "smithing",

  // Special/Craftable Items
  MYSTICAL_POTION = "mystical_potion",
  CRYSTAL_PICKAXE = "crystal_pickaxe",
  ENERGY_CRYSTAL = "energy_crystal",
  SWAMP_ANTIDOTE = "swamp_antidote",
  REED_BASKET = "reed_basket",
  CLAY_POT = "clay_pot",
  MOUNTAIN_PICKAXE = "mountain_pickaxe",
  GEM_NECKLACE = "gem_necklace",
  CLIMBING_ROPE = "climbing_rope",
  HEALING_SALVE = "healing_salve",
  HONEY_BREAD = "honey_bread",
  PINE_TORCH = "pine_torch",
  COTTON_CLOTH = "cotton_cloth",
  FLOWER_DYE = "flower_dye",
  WHEAT_BEER = "wheat_beer",
  SCRAP_TOOL = "scrap_tool",
  QUALITY_SEEDS = "quality_seeds",
  COMMUNITY_MEAL = "community_meal",
}

/**
 * Type representing all possible item rarity values.
 */
export type ItemRarityValue = `${ItemRarity}`;

/**
 * Type representing all possible item tier values.
 */
export type ItemTierValue = `${ItemTier}`;

/**
 * Type representing all possible item category values.
 */
export type ItemCategoryValue = `${ItemCategory}`;

/**
 * Type representing all possible item ID values.
 */
export type ItemIdValue = `${ItemId}`;

/**
 * Array of all item rarities for iteration.
 */
export const ALL_ITEM_RARITIES: readonly ItemRarity[] = Object.values(
  ItemRarity,
) as ItemRarity[];

/**
 * Array of all item tiers for iteration.
 */
export const ALL_ITEM_TIERS: readonly ItemTier[] = Object.values(
  ItemTier,
) as ItemTier[];

/**
 * Array of all item categories for iteration.
 */
export const ALL_ITEM_CATEGORIES: readonly ItemCategory[] = Object.values(
  ItemCategory,
) as ItemCategory[];

/**
 * Array of all item IDs for iteration.
 */
export const ALL_ITEM_IDS: readonly ItemId[] = Object.values(
  ItemId,
) as ItemId[];

/**
 * Type guard to check if a string is a valid ItemRarity.
 */
export function isItemRarity(value: string): value is ItemRarity {
  return Object.values(ItemRarity).includes(value as ItemRarity);
}

/**
 * Type guard to check if a string is a valid ItemTier.
 */
export function isItemTier(value: string): value is ItemTier {
  return Object.values(ItemTier).includes(value as ItemTier);
}

/**
 * Type guard to check if a string is a valid ItemCategory.
 */
export function isItemCategory(value: string): value is ItemCategory {
  return Object.values(ItemCategory).includes(value as ItemCategory);
}

/**
 * Type guard to check if a string is a valid ItemId.
 */
export function isItemId(value: string): value is ItemId {
  return Object.values(ItemId).includes(value as ItemId);
}
