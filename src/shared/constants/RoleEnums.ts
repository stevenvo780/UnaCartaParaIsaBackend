/**
 * Role type enumerations for the simulation system.
 *
 * Defines all work shift types and role types used in role assignments.
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
 * Enumeration of agent role types.
 * Defines all possible roles that agents can be assigned.
 */
export enum RoleType {
  LOGGER = "logger",
  QUARRYMAN = "quarryman",
  MINER = "miner",
  BUILDER = "builder",
  FARMER = "farmer",
  GATHERER = "gatherer",
  GUARD = "guard",
  HUNTER = "hunter",
  CRAFTSMAN = "craftsman",
  LEADER = "leader",
  IDLE = "idle",
}

/**
 * Type representing all possible work shift values.
 */
export type WorkShiftValue = `${WorkShift}`;

/**
 * Type representing all possible role type values.
 */
export type RoleTypeValue = `${RoleType}`;

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

/**
 * Array of all role types for iteration.
 */
export const ALL_ROLE_TYPES: readonly RoleType[] = Object.values(
  RoleType,
) as RoleType[];

/**
 * Type guard to check if a string is a valid RoleType.
 */
export function isRoleType(value: string): value is RoleType {
  return Object.values(RoleType).includes(value as RoleType);
}
