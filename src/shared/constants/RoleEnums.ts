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
export const ALL_ROLE_TYPES: readonly RoleType[] = Object.values(
  RoleType,
) as RoleType[];

// Alias/listas/guards innecesarios eliminados; sólo se mantiene `ALL_ROLE_TYPES`
// porque lo consume RoleSystem para iterar todos los roles disponibles.
