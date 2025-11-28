/**
 * Equipment type enumerations for the simulation system.
 *
 * Defines equipment slots, tool types and their bonuses.
 *
 * @module shared/constants/EquipmentEnums
 */

/**
 * Equipment slots available for agents.
 */
export enum EquipmentSlot {
  /** Primary hand weapon/tool */
  MAIN_HAND = "main_hand",
  /** Secondary hand (shield, offhand tool) */
  OFF_HAND = "off_hand",
  /** Body armor */
  BODY = "body",
  /** Head protection */
  HEAD = "head",
}

/**
 * Equipment type classification for determining bonuses.
 */
export enum EquipmentType {
  /** No tool equipped */
  UNARMED = "unarmed",
  /** Axes for wood gathering */
  AXE = "axe",
  /** Pickaxes for stone/ore gathering */
  PICKAXE = "pickaxe",
  /** Melee weapons for hunting/combat */
  MELEE_WEAPON = "melee_weapon",
  /** Ranged weapons for hunting */
  RANGED_WEAPON = "ranged_weapon",
  /** General gathering tools */
  GATHERING_TOOL = "gathering_tool",
}

/**
 * Resource types that can be affected by tool bonuses.
 */
export enum GatherableResource {
  WOOD = "wood",
  STONE = "stone",
  FOOD = "food",
  ORE = "ore",
  FIBER = "fiber",
}
