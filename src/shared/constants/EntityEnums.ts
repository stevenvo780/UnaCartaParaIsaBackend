/**
 * Entity type enumerations for the simulation system.
 *
 * Defines all entity types and target types used throughout the simulation.
 *
 * @module shared/constants/EntityEnums
 */

/**
 * Enumeration of entity types.
 */
export enum EntityType {
  AGENT = "agent",
  ANIMAL = "animal",
  BUILDING = "building",
  ZONE = "zone",
  RESOURCE = "resource",
  TILE = "tile",
  ALL = "all",
}

/**
 * Enumeration of target types for commands and interactions.
 */
export enum TargetType {
  AGENT = "agent",
  UNKNOWN = "unknown",
}

// `EntityStat` enum eliminado; los sistemas operan con cadenas libres.
