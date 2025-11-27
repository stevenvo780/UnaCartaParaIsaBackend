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

/**
 * Type representing all possible combat event type values.
 */
export type CombatEventTypeValue = `${CombatEventType}`;

/**
 * Array of all combat event types for iteration.
 */
export const ALL_COMBAT_EVENT_TYPES: readonly CombatEventType[] = Object.values(
  CombatEventType,
) as CombatEventType[];

/**
 * Type guard to check if a string is a valid CombatEventType.
 */
export function isCombatEventType(value: string): value is CombatEventType {
  return Object.values(CombatEventType).includes(value as CombatEventType);
}
