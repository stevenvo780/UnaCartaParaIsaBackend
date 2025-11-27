/**
 * Time-related enumerations for the simulation system.
 *
 * Defines all time-related types including time of day phases.
 *
 * @module shared/constants/TimeEnums
 */

/**
 * Enumeration of time of day phases.
 * Represents different periods of the day in the simulation.
 */
export enum TimeOfDayPhase {
  DAWN = "dawn",
  MORNING = "morning",
  MIDDAY = "midday",
  AFTERNOON = "afternoon",
  DUSK = "dusk",
  NIGHT = "night",
  DEEP_NIGHT = "deep_night",
}

/**
 * Type representing all possible time of day phase values.
 */
export type TimeOfDayPhaseValue = `${TimeOfDayPhase}`;

/**
 * Array of all time of day phases for iteration.
 */
export const ALL_TIME_OF_DAY_PHASES: readonly TimeOfDayPhase[] = Object.values(
  TimeOfDayPhase,
) as TimeOfDayPhase[];

/**
 * Type guard to check if a string is a valid TimeOfDayPhase.
 */
export function isTimeOfDayPhase(value: string): value is TimeOfDayPhase {
  return Object.values(TimeOfDayPhase).includes(value as TimeOfDayPhase);
}
