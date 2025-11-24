import type { Weapon, WeaponId } from "../../domain/types/simulation/combat";

export const WEAPON_CATALOG: Record<WeaponId, Weapon> = {
  unarmed: {
    id: "unarmed",
    name: "Puños",
    baseDamage: 6,
    critChance: 0.05,
    critMultiplier: 1.5,
    range: 40,
  },
  wooden_club: {
    id: "wooden_club",
    name: "Garrote de madera",
    baseDamage: 10,
    critChance: 0.07,
    critMultiplier: 1.6,
    range: 45,
    attackSpeed: 3.5,
  },
  stone_dagger: {
    id: "stone_dagger",
    name: "Daga de piedra",
    baseDamage: 14,
    critChance: 0.12,
    critMultiplier: 1.9,
    range: 42,
    attackSpeed: 2.8,
  },
};

export function getWeapon(id: WeaponId): Weapon {
  return WEAPON_CATALOG[id];
}
