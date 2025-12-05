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
