/**
 * Entity status enumerations for the simulation system.
 *
 * Defines all entity status values used throughout the simulation.
 *
 * @module shared/constants/EntityStatusEnums
 */

/**
 * Enumeration of entity status values.
 */
export enum EntityStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DEAD = "dead",
  SPAWNING = "spawning",
  DESPAWNING = "despawning",
  DISABLED = "disabled",
}

/**
 * Type representing all possible entity status values.
 */
export type EntityStatusValue = `${EntityStatus}`;

/**
 * Array of all entity statuses for iteration.
 */
export const ALL_ENTITY_STATUSES: readonly EntityStatus[] = Object.values(
  EntityStatus,
) as EntityStatus[];

/**
 * Type guard to check if a string is a valid EntityStatus.
 */
export function isEntityStatus(value: string): value is EntityStatus {
  return Object.values(EntityStatus).includes(value as EntityStatus);
}
