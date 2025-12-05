/**
 * Resource type enumerations for the simulation system.
 *
 * Defines all resource types, world resource types, resource states,
 * and interaction types used throughout the simulation.
 *
 * @module shared/constants/ResourceEnums
 */

/**
 * Enumeration of basic resource types that can be gathered, stored, and traded.
 */
export enum ResourceType {
  WOOD = "wood",
  STONE = "stone",
  FOOD = "food",
  WATER = "water",
  RARE_MATERIALS = "rare_materials",
  METAL = "metal",
  IRON_ORE = "iron_ore",
  COPPER_ORE = "copper_ore",
}

/**
 * Enumeration of world resource types (nodes that can be harvested).
 */
export enum WorldResourceType {
  TREE = "tree",
  ROCK = "rock",
  TRASH_PILE = "trash_pile",
  WATER_SOURCE = "water_source",
  BERRY_BUSH = "berry_bush",
  MUSHROOM_PATCH = "mushroom_patch",
  WHEAT_CROP = "wheat_crop",
}

/**
 * Enumeration of resource states (harvesting progression).
 */
export enum ResourceState {
  PRISTINE = "pristine",
  HARVESTED_PARTIAL = "harvested_partial",
  DEPLETED = "depleted",
  REGENERATING = "regenerating",
}

/**
 * Enumeration of resource interaction types (how agents interact with resources).
 */
export enum ResourceInteractionType {
  CHOP = "chop",
  MINE = "mine",
  SEARCH = "search",
  COLLECT = "collect",
  GATHER = "gather",
}

/**
 * Enumeration of resource restore sources.
 * Indicates where a restored resource came from.
 */
export enum RestoreSource {
  WORLD = "world",
  INVENTORY = "inventory",
  STOCKPILE = "stockpile",
}

/**
 * Enumeration of world entity types for asset loading and rendering.
 * These represent visual entity types in the world.
 */
export enum WorldEntityType {
  TREE = "tree",
  ROCK = "rock",
  PLANT = "plant",
  PROP = "prop",
}

// Alias/listas/guards eliminados; las validaciones viven en resourceMapping.ts.
