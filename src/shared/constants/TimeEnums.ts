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
// Alias/lista/guard eliminados para mantener sólo el enum.
