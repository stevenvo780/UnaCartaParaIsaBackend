/**
 * Common constants used throughout the simulation system.
 *
 * Defines shared string literals and common values that are used
 * across multiple systems to ensure consistency.
 *
 * @module shared/constants/CommonConstants
 */

/**
 * Constant representing an unknown value.
 * Used when a value cannot be determined or is not applicable.
 */
export const UNKNOWN_VALUE = "unknown" as const;

/**
 * Type for the unknown value constant.
 */
export type UnknownValue = typeof UNKNOWN_VALUE;

/**
 * Default agent names used when generating new agents.
 */
export const DEFAULT_AGENT_NAMES = ["isa", "stev"] as const;

/**
 * Type for default agent names.
 */
export type DefaultAgentName = (typeof DEFAULT_AGENT_NAMES)[number];

/**
 * Default lineage identifier for community-based agents.
 */
export const DEFAULT_LINEAGE = "community" as const;

/**
 * Type for the default lineage constant.
 */
export type DefaultLineage = typeof DEFAULT_LINEAGE;

/**
 * Common string values used across the system.
 */
export const COMMON_STRINGS = {
  UNKNOWN: UNKNOWN_VALUE,
  DEFAULT_LINEAGE,
  DEFAULT_AGENT_NAMES,
} as const;

