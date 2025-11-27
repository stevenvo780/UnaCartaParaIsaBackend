/**
 * Role type enumerations for the simulation system.
 *
 * Defines all work shift types used in role assignments.
 *
 * @module shared/constants/RoleEnums
 */

/**
 * Enumeration of work shift types.
 */
export enum WorkShift {
  MORNING = "morning",
  AFTERNOON = "afternoon",
  EVENING = "evening",
  NIGHT = "night",
  REST = "rest",
}

/**
 * Type representing all possible work shift values.
 */
export type WorkShiftValue = `${WorkShift}`;

/**
 * Array of all work shifts for iteration.
 */
export const ALL_WORK_SHIFTS: readonly WorkShift[] = Object.values(
  WorkShift,
) as WorkShift[];

/**
 * Type guard to check if a string is a valid WorkShift.
 */
export function isWorkShift(value: string): value is WorkShift {
  return Object.values(WorkShift).includes(value as WorkShift);
}
