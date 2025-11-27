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
 * Type representing all possible crisis severity values.
 */
export type CrisisSeverityValue = `${CrisisSeverity}`;

/**
 * Type representing all possible crisis trend values.
 */
export type CrisisTrendValue = `${CrisisTrend}`;

/**
 * Type representing all possible dialogue priority values.
 */
export type DialoguePriorityValue = `${DialoguePriority}`;

/**
 * Type representing all possible dialogue tone values.
 */
export type DialogueToneValue = `${DialogueTone}`;

/**
 * Type representing all possible ambient mood values.
 */
export type AmbientMoodValue = `${AmbientMood}`;

/**
 * Type representing all possible crisis prediction type values.
 */
export type CrisisPredictionTypeValue = `${CrisisPredictionType}`;

/**
 * Type representing all possible weather type values.
 */
export type WeatherTypeValue = `${WeatherType}`;

/**
 * Type representing all possible dialogue card type values.
 */
export type DialogueCardTypeValue = `${DialogueCardType}`;

/**
 * Type representing all possible dialogue outcome values.
 */
export type DialogueOutcomeValue = `${DialogueOutcome}`;

/**
 * Array of all crisis severity values for iteration.
 */
export const ALL_CRISIS_SEVERITIES: readonly CrisisSeverity[] = Object.values(
  CrisisSeverity,
) as CrisisSeverity[];

/**
 * Array of all crisis trend values for iteration.
 */
export const ALL_CRISIS_TRENDS: readonly CrisisTrend[] = Object.values(
  CrisisTrend,
) as CrisisTrend[];

/**
 * Array of all dialogue priority values for iteration.
 */
export const ALL_DIALOGUE_PRIORITIES: readonly DialoguePriority[] =
  Object.values(DialoguePriority) as DialoguePriority[];

/**
 * Array of all dialogue tone values for iteration.
 */
export const ALL_DIALOGUE_TONES: readonly DialogueTone[] = Object.values(
  DialogueTone,
) as DialogueTone[];

/**
 * Array of all ambient mood values for iteration.
 */
export const ALL_AMBIENT_MOODS: readonly AmbientMood[] = Object.values(
  AmbientMood,
) as AmbientMood[];

/**
 * Array of all crisis prediction type values for iteration.
 */
export const ALL_CRISIS_PREDICTION_TYPES: readonly CrisisPredictionType[] =
  Object.values(CrisisPredictionType) as CrisisPredictionType[];

/**
 * Array of all weather type values for iteration.
 */
export const ALL_WEATHER_TYPES: readonly WeatherType[] = Object.values(
  WeatherType,
) as WeatherType[];

/**
 * Array of all dialogue card type values for iteration.
 */
export const ALL_DIALOGUE_CARD_TYPES: readonly DialogueCardType[] =
  Object.values(DialogueCardType) as DialogueCardType[];

/**
 * Array of all dialogue outcome values for iteration.
 */
export const ALL_DIALOGUE_OUTCOMES: readonly DialogueOutcome[] = Object.values(
  DialogueOutcome,
) as DialogueOutcome[];

/**
 * Type guard to check if a string is a valid CrisisSeverity.
 */
export function isCrisisSeverity(value: string): value is CrisisSeverity {
  return Object.values(CrisisSeverity).includes(value as CrisisSeverity);
}

/**
 * Type guard to check if a string is a valid CrisisTrend.
 */
export function isCrisisTrend(value: string): value is CrisisTrend {
  return Object.values(CrisisTrend).includes(value as CrisisTrend);
}

/**
 * Type guard to check if a string is a valid DialoguePriority.
 */
export function isDialoguePriority(value: string): value is DialoguePriority {
  return Object.values(DialoguePriority).includes(value as DialoguePriority);
}

/**
 * Type guard to check if a string is a valid DialogueTone.
 */
export function isDialogueTone(value: string): value is DialogueTone {
  return Object.values(DialogueTone).includes(value as DialogueTone);
}

/**
 * Type guard to check if a string is a valid AmbientMood.
 */
export function isAmbientMood(value: string): value is AmbientMood {
  return Object.values(AmbientMood).includes(value as AmbientMood);
}

/**
 * Type guard to check if a string is a valid CrisisPredictionType.
 */
export function isCrisisPredictionType(
  value: string,
): value is CrisisPredictionType {
  return Object.values(CrisisPredictionType).includes(
    value as CrisisPredictionType,
  );
}

/**
 * Type guard to check if a string is a valid WeatherType.
 */
export function isWeatherType(value: string): value is WeatherType {
  return Object.values(WeatherType).includes(value as WeatherType);
}

/**
 * Type guard to check if a string is a valid DialogueCardType.
 */
export function isDialogueCardType(value: string): value is DialogueCardType {
  return Object.values(DialogueCardType).includes(value as DialogueCardType);
}

/**
 * Type guard to check if a string is a valid DialogueOutcome.
 */
export function isDialogueOutcome(value: string): value is DialogueOutcome {
  return Object.values(DialogueOutcome).includes(value as DialogueOutcome);
}
