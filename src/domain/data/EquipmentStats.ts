/**
 * Equipment statistics and bonuses configuration.
 *
 * Defines all equipment items with their combat and gathering bonuses.
 * This is the source of truth for what bonuses each tool/weapon provides.
 *
 * @module simulation/data/EquipmentStats
 */

import { ItemId } from "../../shared/constants/ItemEnums";
import { WeaponId } from "../../shared/constants/CraftingEnums";
import {
  EquipmentType,
  GatherableResource,
} from "../../shared/constants/EquipmentEnums";

/**
 * Statistics for an equipment item.
 */
export interface EquipmentStats {
  /** Internal item ID */
  itemId: ItemId | WeaponId;
  /** Display name */
  name: string;
  /** Type of tool/weapon */
  toolType: EquipmentType;
  /**
   * Attack range in world units.
   * - Unarmed: 30 (very close range)
   * - Melee: 60-100
   * - Ranged: 200-400
   */
  attackRange: number;
  /**
   * Base damage multiplier.
   * - Unarmed: 1.0
   * - Stone weapons: 1.5-2.0
   * - Iron weapons: 2.5-3.5
   */
  damageMultiplier: number;
  /**
   * Attack speed multiplier (higher = faster).
   * - Unarmed: 1.0
   * - Heavy weapons: 0.7-0.9
   * - Light weapons: 1.1-1.3
   */
  attackSpeed: number;
  /**
   * Gathering speed bonus per resource type.
   * Value is multiplier (1.5 = 50% faster).
   */
  gatheringBonus: Partial<Record<GatherableResource, number>>;
  /**
   * Extra yield chance per resource type.
   * Value is percentage (0.2 = 20% chance of bonus resources).
   */
  bonusYieldChance: Partial<Record<GatherableResource, number>>;
}

/**
 * Default stats for unarmed agents.
 */
export const UNARMED_STATS: EquipmentStats = {
  itemId: WeaponId.UNARMED,
  name: "Desarmado",
  toolType: EquipmentType.UNARMED,
  attackRange: 30,
  damageMultiplier: 1.0,
  attackSpeed: 1.0,
  gatheringBonus: {},
  bonusYieldChance: {},
};

/**
 * Equipment statistics catalog.
 * Maps ItemId to their combat/gathering stats.
 */
export const EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  [ItemId.STONE_AXE]: {
    itemId: ItemId.STONE_AXE,
    name: "Hacha de Piedra",
    toolType: EquipmentType.AXE,
    attackRange: 50,
    damageMultiplier: 1.3,
    attackSpeed: 0.9,
    gatheringBonus: {
      [GatherableResource.WOOD]: 1.5,
    },
    bonusYieldChance: {
      [GatherableResource.WOOD]: 0.15,
    },
  },
  [ItemId.IRON_AXE]: {
    itemId: ItemId.IRON_AXE,
    name: "Hacha de Hierro",
    toolType: EquipmentType.AXE,
    attackRange: 55,
    damageMultiplier: 1.8,
    attackSpeed: 0.85,
    gatheringBonus: {
      [GatherableResource.WOOD]: 2.0,
    },
    bonusYieldChance: {
      [GatherableResource.WOOD]: 0.25,
    },
  },

  [ItemId.STONE_PICKAXE]: {
    itemId: ItemId.STONE_PICKAXE,
    name: "Pico de Piedra",
    toolType: EquipmentType.PICKAXE,
    attackRange: 45,
    damageMultiplier: 1.2,
    attackSpeed: 0.85,
    gatheringBonus: {
      [GatherableResource.STONE]: 1.5,
      [GatherableResource.ORE]: 1.3,
    },
    bonusYieldChance: {
      [GatherableResource.STONE]: 0.15,
      [GatherableResource.ORE]: 0.1,
    },
  },
  [ItemId.IRON_PICKAXE]: {
    itemId: ItemId.IRON_PICKAXE,
    name: "Pico de Hierro",
    toolType: EquipmentType.PICKAXE,
    attackRange: 50,
    damageMultiplier: 1.5,
    attackSpeed: 0.9,
    gatheringBonus: {
      [GatherableResource.STONE]: 2.0,
      [GatherableResource.ORE]: 1.8,
    },
    bonusYieldChance: {
      [GatherableResource.STONE]: 0.25,
      [GatherableResource.ORE]: 0.2,
    },
  },

  [ItemId.WOODEN_CLUB]: {
    itemId: ItemId.WOODEN_CLUB,
    name: "Garrote de Madera",
    toolType: EquipmentType.MELEE_WEAPON,
    attackRange: 60,
    damageMultiplier: 1.5,
    attackSpeed: 1.1,
    gatheringBonus: {},
    bonusYieldChance: {},
  },
  [ItemId.STONE_DAGGER]: {
    itemId: ItemId.STONE_DAGGER,
    name: "Daga de Piedra",
    toolType: EquipmentType.MELEE_WEAPON,
    attackRange: 80,
    damageMultiplier: 2.0,
    attackSpeed: 1.3,
    gatheringBonus: {
      [GatherableResource.FOOD]: 1.2,
    },
    bonusYieldChance: {
      [GatherableResource.FOOD]: 0.1,
    },
  },
  [ItemId.IRON_SWORD]: {
    itemId: ItemId.IRON_SWORD,
    name: "Espada de Hierro",
    toolType: EquipmentType.MELEE_WEAPON,
    attackRange: 100,
    damageMultiplier: 3.0,
    attackSpeed: 1.0,
    gatheringBonus: {},
    bonusYieldChance: {},
  },

  [ItemId.BOW]: {
    itemId: ItemId.BOW,
    name: "Arco",
    toolType: EquipmentType.RANGED_WEAPON,
    attackRange: 300,
    damageMultiplier: 2.5,
    attackSpeed: 0.7,
    gatheringBonus: {},
    bonusYieldChance: {},
  },
};

/**
 * Gets equipment stats for an item, or unarmed stats if not found.
 */
export function getEquipmentStats(itemId: string | undefined): EquipmentStats {
  if (!itemId || itemId === WeaponId.UNARMED) {
    return UNARMED_STATS;
  }
  return EQUIPMENT_STATS[itemId] ?? UNARMED_STATS;
}

/**
 * Gets the best weapon for hunting/combat.
 * @param availableItems - List of item IDs the agent has
 * @param preferRanged - Whether to prefer ranged weapons
 * @returns The best weapon item ID, or undefined if none
 */
export function getBestWeapon(
  availableItems: string[],
  preferRanged: boolean = false,
): string | undefined {
  let bestWeapon: string | undefined;
  let bestScore = 0;

  for (const itemId of availableItems) {
    const stats = EQUIPMENT_STATS[itemId];
    if (!stats) continue;

    const isWeapon =
      stats.toolType === EquipmentType.MELEE_WEAPON ||
      stats.toolType === EquipmentType.RANGED_WEAPON;
    if (!isWeapon) continue;

    let score = stats.damageMultiplier * stats.attackRange;

    if (preferRanged && stats.toolType === EquipmentType.RANGED_WEAPON) {
      score *= 1.5;
    } else if (!preferRanged && stats.toolType === EquipmentType.MELEE_WEAPON) {
      score *= 1.2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestWeapon = itemId;
    }
  }

  return bestWeapon;
}

/**
 * Recommended tools by role type.
 * Maps role to the tools that would be most useful.
 */
export const ROLE_RECOMMENDED_TOOLS: Record<string, string[]> = {
  hunter: [ItemId.BOW, ItemId.STONE_DAGGER, ItemId.WOODEN_CLUB],
  lumberjack: [ItemId.IRON_AXE, ItemId.STONE_AXE],
  quarryman: [ItemId.IRON_PICKAXE, ItemId.STONE_PICKAXE],
  gatherer: [ItemId.STONE_DAGGER],
  farmer: [ItemId.STONE_AXE],
  builder: [ItemId.STONE_AXE, ItemId.STONE_PICKAXE],
  guard: [ItemId.IRON_SWORD, ItemId.STONE_DAGGER, ItemId.WOODEN_CLUB],
};
