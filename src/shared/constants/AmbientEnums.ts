/**
 * Ambient type enumerations for the simulation system.
 *
 * Defines all ambient-related types including crisis severity, dialogue types,
 * weather types, and mood states used throughout the simulation.
 *
 * @module shared/constants/AmbientEnums
 */

/**
 * Enumeration of crisis severity levels.
 */
export enum CrisisSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Enumeration of crisis trend directions.
 */
export enum CrisisTrend {
  IMPROVING = "improving",
  STABLE = "stable",
  WORSENING = "worsening",
}

/**
 * Enumeration of dialogue priority levels.
 */
export enum DialoguePriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

/**
 * Enumeration of dialogue emotional tones.
 */
export enum DialogueTone {
  HAPPY = "happy",
  SAD = "sad",
  WORRIED = "worried",
  EXCITED = "excited",
  CONTEMPLATIVE = "contemplative",
  PLAYFUL = "playful",
}

/**
 * Enumeration of ambient mood states.
 */
export enum AmbientMood {
  THRIVING = "thriving",
  COMFORTABLE = "comfortable",
  STRESSED = "stressed",
  CRISIS = "crisis",
  COLLAPSE = "collapse",
}

/**
 * Enumeration of crisis prediction types.
 */
export enum CrisisPredictionType {
  RESOURCE_SHORTAGE = "resource_shortage",
  MASS_STARVATION = "mass_starvation",
  SYSTEM_COLLAPSE = "system_collapse",
  POPULATION_CRISIS = "population_crisis",
}

/**
 * Enumeration of weather types.
 */
export enum WeatherType {
  CLEAR = "clear",
  CLOUDY = "cloudy",
  STORMY = "stormy",
  RAINY = "rainy",
  FOGGY = "foggy",
  SNOWY = "snowy",
}

/**
 * Enumeration of dialogue card types.
 */
export enum DialogueCardType {
  MISSION = "mission",
  EVENT = "event",
  MEMORY = "memory",
  REFLECTION = "reflection",
  INTERACTION = "interaction",
}

/**
 * Enumeration of dialogue choice outcomes.
 */
export enum DialogueOutcome {
  POSITIVE = "positive",
  NEGATIVE = "negative",
  NEUTRAL = "neutral",
}

/**
 * Enumeration of dialogue speaker identifiers.
 * Represents who is speaking in dialogue entries.
 */
export enum DialogueSpeaker {
  ISA = "ISA",
  STEV = "STEV",
  NARRATOR = "narrator",
  SYSTEM = "system",
}

