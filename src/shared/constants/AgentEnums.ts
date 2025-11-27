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
 * Enumeration of clothing style types for agent appearance.
 */
export enum ClothingStyle {
  SIMPLE = "simple",
  DECORATED = "decorated",
  ELEGANT = "elegant",
  RUGGED = "rugged",
  MYSTICAL = "mystical",
}

/**
 * Type representing all possible sex values.
 */
export type SexValue = `${Sex}`;

/**
 * Type representing all possible life stage values.
 */
export type LifeStageValue = `${LifeStage}`;

/**
 * Type representing all possible social status values.
 */
export type SocialStatusValue = `${SocialStatus}`;

/**
 * Type representing all possible exploration type values.
 */
export type ExplorationTypeValue = `${ExplorationType}`;

/**
 * Type representing all possible social preference values.
 */
export type SocialPreferenceValue = `${SocialPreference}`;

/**
 * Type representing all possible work ethic values.
 */
export type WorkEthicValue = `${WorkEthic}`;

/**
 * Type representing all possible clothing style values.
 */
export type ClothingStyleValue = `${ClothingStyle}`;

/**
 * Array of all sex values for iteration.
 */
export const ALL_SEX_VALUES: readonly Sex[] = Object.values(Sex) as Sex[];

/**
 * Array of all life stage values for iteration.
 */
export const ALL_LIFE_STAGES: readonly LifeStage[] = Object.values(
  LifeStage,
) as LifeStage[];

/**
 * Array of all social status values for iteration.
 */
export const ALL_SOCIAL_STATUSES: readonly SocialStatus[] = Object.values(
  SocialStatus,
) as SocialStatus[];

/**
 * Type guard to check if a string is a valid Sex.
 */
export function isSex(value: string): value is Sex {
  return Object.values(Sex).includes(value as Sex);
}

/**
 * Type guard to check if a string is a valid LifeStage.
 */
export function isLifeStage(value: string): value is LifeStage {
  return Object.values(LifeStage).includes(value as LifeStage);
}

/**
 * Type guard to check if a string is a valid SocialStatus.
 */
export function isSocialStatus(value: string): value is SocialStatus {
  return Object.values(SocialStatus).includes(value as SocialStatus);
}

/**
 * Type guard to check if a string is a valid ExplorationType.
 */
export function isExplorationType(value: string): value is ExplorationType {
  return Object.values(ExplorationType).includes(value as ExplorationType);
}

/**
 * Type guard to check if a string is a valid SocialPreference.
 */
export function isSocialPreference(value: string): value is SocialPreference {
  return Object.values(SocialPreference).includes(value as SocialPreference);
}

/**
 * Type guard to check if a string is a valid WorkEthic.
 */
export function isWorkEthic(value: string): value is WorkEthic {
  return Object.values(WorkEthic).includes(value as WorkEthic);
}

/**
 * Array of all clothing styles for iteration.
 */
export const ALL_CLOTHING_STYLES: readonly ClothingStyle[] = Object.values(
  ClothingStyle,
) as ClothingStyle[];

/**
 * Type guard to check if a string is a valid ClothingStyle.
 */
export function isClothingStyle(value: string): value is ClothingStyle {
  return Object.values(ClothingStyle).includes(value as ClothingStyle);
}
