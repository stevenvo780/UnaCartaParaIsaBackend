/**
 * Agent type enumerations for the simulation system.
 *
 * Defines all agent-related types including sex, life stages, social status,
 * and personality traits.
 *
 * @module shared/constants/AgentEnums
 */

/**
 * Enumeration of agent sex/gender types.
 */
export enum Sex {
  MALE = "male",
  FEMALE = "female",
}

/**
 * Enumeration of agent life stages.
 */
export enum LifeStage {
  CHILD = "child",
  ADULT = "adult",
  ELDER = "elder",
}

/**
 * Enumeration of agent social status levels.
 */
export enum SocialStatus {
  NOBLE = "noble",
  COMMONER = "commoner",
  WARRIOR = "warrior",
}

/**
 * Enumeration of exploration personality types.
 */
export enum ExplorationType {
  CAUTIOUS = "cautious",
  BALANCED = "balanced",
  ADVENTUROUS = "adventurous",
  DESPERATE_SEARCH = "desperate_search",
  DEFAULT = "default",
}

/**
 * Enumeration of social preference types.
 */
export enum SocialPreference {
  INTROVERTED = "introverted",
  BALANCED = "balanced",
  EXTROVERTED = "extroverted",
}

/**
 * Enumeration of work ethic types.
 */
export enum WorkEthic {
  LAZY = "lazy",
  BALANCED = "balanced",
  WORKAHOLIC = "workaholic",
}

/**
 * Enumeration of appearance update reasons.
 * Defines why an agent's appearance might change.
 */
export enum AppearanceUpdateReason {
  AGING = "aging",
  EQUIPMENT_CHANGE = "equipment_change",
  STATUS_CHANGE = "status_change",
  DAMAGE = "damage",
  HEALING = "healing",
  MOOD_CHANGE = "mood_change",
  INITIAL = "initial",
}

// Type/value helpers were removed to keep the module focused on the enums
// actually used by the simulation runtime.
