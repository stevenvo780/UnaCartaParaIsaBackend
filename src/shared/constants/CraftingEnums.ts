/**
 * Crafting type enumerations for the simulation system.
 *
 * Defines all crafting-related types including weapon IDs and item tiers
 * used throughout the simulation.
 *
 * @module shared/constants/CraftingEnums
 */

/**
 * Enumeration of weapon IDs available in the simulation.
 * Includes both crafted weapons and the unarmed state.
 */
export enum WeaponId {
  UNARMED = "unarmed",
  WOODEN_CLUB = "wooden_club",
  STONE_DAGGER = "stone_dagger",
}

/**
 * Enumeration of item tiers for crafting and item classification.
 */
export enum ItemTier {
  RAW = "raw",
  PROCESSED = "processed",
  CRAFTABLE = "craftable",
  SPECIAL = "special",
}

/**
 * Type representing all possible weapon ID values.
 */
export type WeaponIdValue = `${WeaponId}`;

/**
 * Type representing all possible item tier values.
 */
export type ItemTierValue = `${ItemTier}`;

/**
 * Array of all weapon IDs for iteration.
 */
export const ALL_WEAPON_IDS: readonly WeaponId[] = Object.values(
  WeaponId,
) as WeaponId[];

/**
 * Array of all item tiers for iteration.
 */
export const ALL_ITEM_TIERS: readonly ItemTier[] = Object.values(
  ItemTier,
) as ItemTier[];

/**
 * Type guard to check if a string is a valid WeaponId.
 */
export function isWeaponId(value: string): value is WeaponId {
  return Object.values(WeaponId).includes(value as WeaponId);
}

/**
 * Type guard to check if a string is a valid ItemTier.
 */
export function isItemTier(value: string): value is ItemTier {
  return Object.values(ItemTier).includes(value as ItemTier);
}
