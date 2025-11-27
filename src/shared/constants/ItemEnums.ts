/**
 * Item type enumerations for the simulation system.
 *
 * Defines all item rarity levels used in item generation.
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
 * Type representing all possible item rarity values.
 */
export type ItemRarityValue = `${ItemRarity}`;

/**
 * Array of all item rarities for iteration.
 */
export const ALL_ITEM_RARITIES: readonly ItemRarity[] = Object.values(
  ItemRarity,
) as ItemRarity[];

/**
 * Type guard to check if a string is a valid ItemRarity.
 */
export function isItemRarity(value: string): value is ItemRarity {
  return Object.values(ItemRarity).includes(value as ItemRarity);
}
