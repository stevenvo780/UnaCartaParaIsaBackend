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
  ZONE = "zone",
  RESOURCE = "resource",
  ALL = "all",
}

/**
 * Enumeration of target types for commands and interactions.
 */
export enum TargetType {
  AGENT = "agent",
  UNKNOWN = "unknown",
}

/**
 * Enumeration of entity stats and effects.
 */
export enum EntityStat {
  HEALTH = "health",
  ENERGY = "energy",
  STAMINA = "stamina",
  HUNGER = "hunger",
  THIRST = "thirst",
  SLEEPINESS = "sleepiness",
  MENTAL_HEALTH = "mentalHealth",
  INTELLIGENCE = "intelligence",
  HAPPINESS = "happiness",
  STRESS = "stress",
  BOREDOM = "boredom",
  LONELINESS = "loneliness",
  SOCIAL_SKILLS = "socialSkills",
  COMFORT = "comfort",
  CREATIVITY = "creativity",
  RESONANCE = "resonance",
  COURAGE = "courage",
  MONEY = "money",
  SAFETY = "safety",
}

/**
 * Type representing all possible entity type values.
 */
export type EntityTypeValue = `${EntityType}`;

/**
 * Type representing all possible target type values.
 */
export type TargetTypeValue = `${TargetType}`;

/**
 * Array of all entity types for iteration.
 */
export const ALL_ENTITY_TYPES: readonly EntityType[] = Object.values(
  EntityType,
) as EntityType[];

/**
 * Array of all target types for iteration.
 */
export const ALL_TARGET_TYPES: readonly TargetType[] = Object.values(
  TargetType,
) as TargetType[];

/**
 * Type guard to check if a string is a valid EntityType.
 */
export function isEntityType(value: string): value is EntityType {
  return Object.values(EntityType).includes(value as EntityType);
}

/**
 * Type guard to check if a string is a valid TargetType.
 */
export function isTargetType(value: string): value is TargetType {
  return Object.values(TargetType).includes(value as TargetType);
}
