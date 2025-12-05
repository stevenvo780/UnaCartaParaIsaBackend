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
