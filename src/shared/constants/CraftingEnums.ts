/**
 * Crafting type enumerations for the simulation system.
 *
 * Defines all crafting-related types including weapon IDs and item tiers
 * used throughout the simulation.
 *
 * @module shared/constants/CraftingEnums
 */

/**
 * Enumeration of weapon IDs available in the simulation.
 * Includes both crafted weapons and the unarmed state.
 */
export enum WeaponId {
  UNARMED = "unarmed",
  WOODEN_CLUB = "wooden_club",
  STONE_DAGGER = "stone_dagger",
}

/**
 * Enumeration of workstation types used in crafting.
 * Workstations are required for certain crafting recipes.
 */
export enum WorkstationType {
  FURNACE = "furnace",
  KILN = "kiln",
  OVEN = "oven",
  LOOM = "loom",
  CAMPFIRE = "campfire",
  COOKING_POT = "cooking_pot",
  ANVIL = "anvil",
  ALCHEMY_TABLE = "alchemy_table",
  BREWING_BARREL = "brewing_barrel",
}

/**
 * Enumeration of skill types used in crafting and other activities.
 */
export enum SkillType {
  HERBALISM = "herbalism",
  MYSTICISM = "mysticism",
  MINING = "mining",
  JEWELCRAFTING = "jewelcrafting",
  SMITHING = "smithing",
  CRAFTING = "crafting",
  LEATHERWORKING = "leatherworking",
  CARPENTRY = "carpentry",
}

/**
 * Enumeration of tool types used in crafting recipes.
 */
export enum ToolType {
  NEEDLE = "needle",
  MORTAR = "mortar",
}
