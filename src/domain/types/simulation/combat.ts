export type WeaponId = "unarmed" | "wooden_club" | "stone_dagger";

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

export type CombatEventType =
  | "engaged"
  | "hit"
  | "kill"
  | "weapon_crafted"
  | "weapon_equipped";

export interface CombatLogEntryBase {
  id: string;
  type: CombatEventType;
  timestamp: number;
}

export interface CombatEngagedLog extends CombatLogEntryBase {
  type: "engaged";
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
  type: "hit";
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
  type: "kill";
  attackerId: string;
  targetId: string;
  weapon: WeaponId;
}

export interface CombatWeaponCraftedLog extends CombatLogEntryBase {
  type: "weapon_crafted";
  agentId: string;
  weapon: WeaponId;
}

export interface CombatWeaponEquippedLog extends CombatLogEntryBase {
  type: "weapon_equipped";
  agentId: string;
  weapon: WeaponId;
}

export type CombatLogEntry =
  | CombatEngagedLog
  | CombatHitLog
  | CombatKillLog
  | CombatWeaponCraftedLog
  | CombatWeaponEquippedLog;
