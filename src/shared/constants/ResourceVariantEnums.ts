/**
 * Resource variant enumerations for the simulation system.
 *
 * Defines all visual variants for world resources.
 *
 * @module shared/constants/ResourceVariantEnums
 */

/**
 * Enumeration of tree visual variants.
 */
export enum TreeVariant {
  FULL = "tree_full",
  DAMAGED = "tree_damaged",
  STUMP = "tree_stump",
}

/**
 * Enumeration of rock visual variants.
 */
export enum RockVariant {
  INTACT = "rock_intact",
  CRACKED = "rock_cracked",
  RUBBLE = "rock_rubble",
}

/**
 * Enumeration of water source visual variants.
 */
export enum WaterSourceVariant {
  FULL = "water_source",
  DRY = "water_source_dry",
}

/**
 * Enumeration of berry bush visual variants.
 */
export enum BerryBushVariant {
  FULL = "berry_bush_full",
  EMPTY = "berry_bush_empty",
}

/**
 * Enumeration of mushroom patch visual variants.
 */
export enum MushroomVariant {
  FULL = "mushrooms",
  PICKED = "mushrooms_picked",
}

/**
 * Enumeration of wheat crop visual variants.
 */
export enum WheatVariant {
  FULL = "wheat_full",
  HARVESTED = "wheat_harvested",
}

/**
 * Enumeration of trash pile visual variants.
 */
export enum TrashVariant {
  FULL = "trash_pile",
  CLEARED = "trash_pile_cleared",
}
