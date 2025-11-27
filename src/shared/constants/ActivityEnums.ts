/**
 * Activity type enumerations for the simulation system.
 *
 * Defines all activity types that agents can perform in zones.
 *
 * @module shared/constants/ActivityEnums
 */

/**
 * Enumeration of activity types that agents can perform.
 */
export enum ActivityType {
  EATING = "eating",
  RESTING = "resting",
  SOCIALIZING = "socializing",
  WORKING = "working",
  IDLE = "idle",
}

/**
 * Type representing all possible activity type values.
 */
export type ActivityTypeValue = `${ActivityType}`;

/**
 * Array of all activity types for iteration.
 */
export const ALL_ACTIVITY_TYPES: readonly ActivityType[] = Object.values(
  ActivityType,
) as ActivityType[];

/**
 * Type guard to check if a string is a valid ActivityType.
 */
export function isActivityType(value: string): value is ActivityType {
  return Object.values(ActivityType).includes(value as ActivityType);
}
