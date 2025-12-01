/**
 * Quest type enumerations for the frontend.
 *
 * Defines all quest-related types used in the frontend.
 * These enums should match the backend enums for consistency.
 *
 * @module constants/QuestEnums
 */

/**
 * Enumeration of quest statuses.
 * Matches backend QuestStatus enum.
 */
export enum QuestStatus {
  AVAILABLE = "available",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  NOT_STARTED = "not_started",
  ABANDONED = "abandoned",
}

/**
 * Enumeration of quest dialogue stages.
 * Matches backend QuestDialogueStage enum.
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
 * Array of all quest dialogue stages for iteration.
 */
export const ALL_QUEST_DIALOGUE_STAGES: readonly QuestDialogueStage[] =
  Object.values(QuestDialogueStage) as QuestDialogueStage[];

/**
 * Type guard to check if a string is a valid QuestStatus.
 */
export function isQuestStatus(value: string): value is QuestStatus {
  return Object.values(QuestStatus).includes(value as QuestStatus);
}

/**
 * Type guard to check if a string is a valid QuestDialogueStage.
 */
export function isQuestDialogueStage(
  value: string,
): value is QuestDialogueStage {
  return Object.values(QuestDialogueStage).includes(
    value as QuestDialogueStage,
  );
}
