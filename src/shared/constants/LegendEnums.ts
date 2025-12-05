/**
 * Legend-related enumerations for the simulation system.
 *
 * Defines tiers and types for the Living Legends system.
 *
 * @module shared/constants/LegendEnums
 */

/**
 * Enumeration of legend tiers representing an agent's renown level.
 */
export enum LegendTier {
  UNKNOWN = "unknown",
  KNOWN = "known",
  RESPECTED = "respected",
  RENOWNED = "renowned",
  LEGENDARY = "legendary",
  MYTHICAL = "mythical",
}

/**
 * Enumeration of deed types for legendary actions.
 */
export enum DeedType {
  HEROIC = "heroic",
  VILLAINOUS = "villainous",
  NEUTRAL = "neutral",
}

/**
 * Enumeration of story moods for generated narratives.
 */
export enum StoryMood {
  EPIC = "epic",
  TRAGIC = "tragic",
  COMEDIC = "comedic",
  MYSTERIOUS = "mysterious",
}

/**
 * Enumeration of reputation trends.
 */
export enum ReputationTrend {
  RISING = "rising",
  FALLING = "falling",
  STABLE = "stable",
}

/**
 * Type representing all possible legend tier values.
 */
export type LegendTierValue = `${LegendTier}`;

/**
 * Array of all legend tiers for iteration.
 */
export const ALL_LEGEND_TIERS: readonly LegendTier[] = Object.values(
  LegendTier,
) as LegendTier[];

/**
 * Type guard to check if a string is a valid LegendTier.
 */
export function isLegendTier(value: string): value is LegendTier {
  return Object.values(LegendTier).includes(value as LegendTier);
}

/**
 * Type guard to check if a string is a valid DeedType.
 */
export function isDeedType(value: string): value is DeedType {
  return Object.values(DeedType).includes(value as DeedType);
}

/**
 * Type guard to check if a string is a valid StoryMood.
 */
export function isStoryMood(value: string): value is StoryMood {
  return Object.values(StoryMood).includes(value as StoryMood);
}
