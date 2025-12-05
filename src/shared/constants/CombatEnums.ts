/**
 * Combat type enumerations for the simulation system.
 *
 * Defines all combat event types used in combat logging.
 *
 * @module shared/constants/CombatEnums
 */

/**
 * Enumeration of combat event types.
 */
export enum CombatEventType {
  ENGAGED = "engaged",
  HIT = "hit",
  KILL = "kill",
  WEAPON_CRAFTED = "weapon_crafted",
  WEAPON_EQUIPPED = "weapon_equipped",
}

// Eliminados type guards/aliases sin uso para mantener el módulo mínimo.
