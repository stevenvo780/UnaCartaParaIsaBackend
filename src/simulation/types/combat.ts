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
