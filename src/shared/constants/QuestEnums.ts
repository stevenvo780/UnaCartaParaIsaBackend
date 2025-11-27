/**
 * Quest type enumerations for the simulation system.
 *
 * Defines all quest-related types including status, difficulty, reward types,
 * requirement types, and dialogue stages.
 *
 * @module shared/constants/QuestEnums
 */

/**
 * Enumeration of quest statuses.
 */
export enum QuestStatus {
  AVAILABLE = "available",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  NOT_STARTED = "not_started",
}

/**
 * Enumeration of quest difficulty levels.
 */
export enum QuestDifficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
  DAILY = "daily",
}

/**
 * Enumeration of quest reward types.
 */
export enum QuestRewardType {
  EXPERIENCE = "experience",
  MONEY = "money",
  ITEM = "item",
  STATS_BOOST = "stats_boost",
  TITLE = "title",
  UNLOCK_FEATURE = "unlock_feature",
}

/**
 * Enumeration of quest requirement types.
 */
export enum QuestRequirementType {
  QUEST_COMPLETED = "quest_completed",
  STATS_THRESHOLD = "stats_threshold",
  TIME_ELAPSED = "time_elapsed",
  ITEM_OWNED = "item_owned",
}

/**
 * Enumeration of quest dialogue stages.
 */
export enum QuestDialogueStage {
  INTRO = "intro",
  PROGRESS = "progress",
  COMPLETION = "completion",
  FAILURE = "failure",
}

/**
 * Type representing all possible quest status values.
 */
export type QuestStatusValue = `${QuestStatus}`;

/**
 * Type representing all possible quest difficulty values.
 */
export type QuestDifficultyValue = `${QuestDifficulty}`;

/**
 * Type representing all possible quest reward type values.
 */
export type QuestRewardTypeValue = `${QuestRewardType}`;

/**
 * Type representing all possible quest requirement type values.
 */
export type QuestRequirementTypeValue = `${QuestRequirementType}`;

/**
 * Type representing all possible quest dialogue stage values.
 */
export type QuestDialogueStageValue = `${QuestDialogueStage}`;

/**
 * Array of all quest statuses for iteration.
 */
export const ALL_QUEST_STATUSES: readonly QuestStatus[] = Object.values(
  QuestStatus,
) as QuestStatus[];

/**
 * Array of all quest difficulties for iteration.
 */
export const ALL_QUEST_DIFFICULTIES: readonly QuestDifficulty[] = Object.values(
  QuestDifficulty,
) as QuestDifficulty[];

/**
 * Array of all quest reward types for iteration.
 */
export const ALL_QUEST_REWARD_TYPES: readonly QuestRewardType[] = Object.values(
  QuestRewardType,
) as QuestRewardType[];

/**
 * Array of all quest requirement types for iteration.
 */
export const ALL_QUEST_REQUIREMENT_TYPES: readonly QuestRequirementType[] =
  Object.values(QuestRequirementType) as QuestRequirementType[];

/**
 * Type guard to check if a string is a valid QuestStatus.
 */
export function isQuestStatus(value: string): value is QuestStatus {
  return Object.values(QuestStatus).includes(value as QuestStatus);
}

/**
 * Type guard to check if a string is a valid QuestDifficulty.
 */
export function isQuestDifficulty(value: string): value is QuestDifficulty {
  return Object.values(QuestDifficulty).includes(value as QuestDifficulty);
}

/**
 * Type guard to check if a string is a valid QuestRewardType.
 */
export function isQuestRewardType(value: string): value is QuestRewardType {
  return Object.values(QuestRewardType).includes(value as QuestRewardType);
}

/**
 * Type guard to check if a string is a valid QuestRequirementType.
 */
export function isQuestRequirementType(
  value: string,
): value is QuestRequirementType {
  return Object.values(QuestRequirementType).includes(
    value as QuestRequirementType,
  );
}
