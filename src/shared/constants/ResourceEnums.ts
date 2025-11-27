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
 * Type representing all possible resource type values.
 */
export type ResourceTypeValue = `${ResourceType}`;

/**
 * Type representing all possible world resource type values.
 */
export type WorldResourceTypeValue = `${WorldResourceType}`;

/**
 * Type representing all possible resource state values.
 */
export type ResourceStateValue = `${ResourceState}`;

/**
 * Type representing all possible resource interaction type values.
 */
export type ResourceInteractionTypeValue = `${ResourceInteractionType}`;

/**
 * Array of all resource types for iteration.
 */
export const ALL_RESOURCE_TYPES: readonly ResourceType[] = Object.values(
  ResourceType,
) as ResourceType[];

/**
 * Array of all world resource types for iteration.
 */
export const ALL_WORLD_RESOURCE_TYPES: readonly WorldResourceType[] =
  Object.values(WorldResourceType) as WorldResourceType[];

/**
 * Array of all resource states for iteration.
 */
export const ALL_RESOURCE_STATES: readonly ResourceState[] = Object.values(
  ResourceState,
) as ResourceState[];

/**
 * Array of all resource interaction types for iteration.
 */
export const ALL_RESOURCE_INTERACTION_TYPES: readonly ResourceInteractionType[] =
  Object.values(ResourceInteractionType) as ResourceInteractionType[];

/**
 * Type guard to check if a string is a valid ResourceType.
 */
export function isResourceType(value: string): value is ResourceType {
  return Object.values(ResourceType).includes(value as ResourceType);
}

/**
 * Type guard to check if a string is a valid WorldResourceType.
 */
export function isWorldResourceType(value: string): value is WorldResourceType {
  return Object.values(WorldResourceType).includes(value as WorldResourceType);
}

/**
 * Type guard to check if a string is a valid ResourceState.
 */
export function isResourceState(value: string): value is ResourceState {
  return Object.values(ResourceState).includes(value as ResourceState);
}

/**
 * Type guard to check if a string is a valid ResourceInteractionType.
 */
export function isResourceInteractionType(
  value: string,
): value is ResourceInteractionType {
  return Object.values(ResourceInteractionType).includes(
    value as ResourceInteractionType,
  );
}
