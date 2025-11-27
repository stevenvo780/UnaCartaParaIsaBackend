import { WeaponId } from "../../../shared/constants/CraftingEnums";
export { WeaponId };

export interface Weapon {
  id: WeaponId;
  name: string;
  baseDamage: number;
  critChance: number;
  critMultiplier: number;
  range: number;
  attackSpeed?: number;
}

export interface AttackResult {
  attackerId: string;
  targetId: string;
  weaponId: WeaponId;
  damage: number;
  crit: boolean;
  remainingHealth: number;
  killed?: boolean;
}

import { CombatEventType } from "../../../shared/constants/CombatEnums";

export { CombatEventType };

export interface CombatLogEntryBase {
  id: string;
  type: CombatEventType;
  timestamp: number;
}

export interface CombatEngagedLog extends CombatLogEntryBase {
  type: CombatEventType.ENGAGED;
  attackerId: string;
  targetId: string;
  weapon: WeaponId;
  attackerX?: number;
  attackerY?: number;
  targetX?: number;
  targetY?: number;
  attackerHealth: number;
  targetHealth: number;
}

export interface CombatHitLog extends CombatLogEntryBase {
  type: CombatEventType.HIT;
  attackerId: string;
  targetId: string;
  weapon: WeaponId;
  damage: number;
  crit: boolean;
  remainingHealth: number;
  x?: number;
  y?: number;
}

export interface CombatKillLog extends CombatLogEntryBase {
  type: CombatEventType.KILL;
  attackerId: string;
  targetId: string;
  weapon: WeaponId;
}

export interface CombatWeaponCraftedLog extends CombatLogEntryBase {
  type: CombatEventType.WEAPON_CRAFTED;
  agentId: string;
  weapon: WeaponId;
}

export interface CombatWeaponEquippedLog extends CombatLogEntryBase {
  type: CombatEventType.WEAPON_EQUIPPED;
  agentId: string;
  weapon: WeaponId;
}

export type CombatLogEntry =
  | CombatEngagedLog
  | CombatHitLog
  | CombatKillLog
  | CombatWeaponCraftedLog
  | CombatWeaponEquippedLog;
