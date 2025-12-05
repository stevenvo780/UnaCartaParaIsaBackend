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
 * Enumeration of conflict resolution outcomes.
 * These represent the final state of a conflict after resolution.
 */
export enum ConflictResolution {
  TRUCE_ACCEPTED = "truce_accepted",
  APOLOGIZED = "apologized",
  CONTINUED = "continued",
  EXPIRED = "expired",
}

// Alias/guards eliminados; sólo quedan los enums usados por los sistemas.
