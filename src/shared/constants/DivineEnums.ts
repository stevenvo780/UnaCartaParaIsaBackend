/**
 * Divine type enumerations for the simulation system.
 *
 * Defines all god/deity IDs used in the simulation.
 *
 * @module shared/constants/DivineEnums
 */

/**
 * Enumeration of god/deity IDs.
 */
export enum GodId {
  ISA = "isa",
  STEV = "stev",
}

/**
 * Type representing all possible god ID values.
 */
export type GodIdValue = `${GodId}`;

/**
 * Array of all god IDs for iteration.
 */
export const ALL_GOD_IDS: readonly GodId[] = Object.values(GodId) as GodId[];

/**
 * Type guard to check if a string is a valid GodId.
 */
export function isGodId(value: string): value is GodId {
  return Object.values(GodId).includes(value as GodId);
}
