/**
 * Conflict type enumerations for the simulation system.
 *
 * Defines all conflict-related types including resolution choices
 * used in conflict resolution system.
 *
 * @module shared/constants/ConflictEnums
 */

/**
 * Enumeration of conflict resolution choices available to agents.
 * These choices determine how conflicts are resolved.
 */
export enum ConflictResolutionChoice {
  TRUCE_ACCEPT = "truce_accept",
  APOLOGIZE = "apologize",
  CONTINUE = "continue",
}

/**
 * Type representing all possible conflict resolution choice values.
 */
export type ConflictResolutionChoiceValue = `${ConflictResolutionChoice}`;

/**
 * Array of all conflict resolution choices for iteration.
 */
export const ALL_CONFLICT_RESOLUTION_CHOICES: readonly ConflictResolutionChoice[] =
  Object.values(ConflictResolutionChoice) as ConflictResolutionChoice[];

/**
 * Type guard to check if a string is a valid ConflictResolutionChoice.
 */
export function isConflictResolutionChoice(
  value: string,
): value is ConflictResolutionChoice {
  return Object.values(ConflictResolutionChoice).includes(
    value as ConflictResolutionChoice,
  );
}

/**
 * Enumeration of conflict resolution outcomes.
 * These represent the final state of a conflict after resolution.
 */
export enum ConflictResolution {
  TRUCE_ACCEPTED = "truce_accepted",
  APOLOGIZED = "apologized",
  CONTINUED = "continued",
  EXPIRED = "expired",
}

/**
 * Type representing all possible conflict resolution values.
 */
export type ConflictResolutionValue = `${ConflictResolution}`;

/**
 * Array of all conflict resolutions for iteration.
 */
export const ALL_CONFLICT_RESOLUTIONS: readonly ConflictResolution[] =
  Object.values(ConflictResolution) as ConflictResolution[];

/**
 * Type guard to check if a string is a valid ConflictResolution.
 */
export function isConflictResolution(
  value: string,
): value is ConflictResolution {
  return Object.values(ConflictResolution).includes(
    value as ConflictResolution,
  );
}
