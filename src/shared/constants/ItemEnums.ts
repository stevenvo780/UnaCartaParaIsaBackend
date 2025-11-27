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
 * Type representing all possible item rarity values.
 */
export type ItemRarityValue = `${ItemRarity}`;

/**
 * Type representing all possible item tier values.
 */
export type ItemTierValue = `${ItemTier}`;

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
 * Type representing all possible item category values.
 */
export type ItemCategoryValue = `${ItemCategory}`;

/**
 * Array of all item categories for iteration.
 */
export const ALL_ITEM_CATEGORIES: readonly ItemCategory[] = Object.values(
  ItemCategory,
) as ItemCategory[];

/**
 * Type guard to check if a string is a valid ItemCategory.
 */
export function isItemCategory(value: string): value is ItemCategory {
  return Object.values(ItemCategory).includes(value as ItemCategory);
}
