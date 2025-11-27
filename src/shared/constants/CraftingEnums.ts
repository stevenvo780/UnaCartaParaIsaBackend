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
 * Enumeration of item tiers for crafting and item classification.
 */
export enum ItemTier {
  RAW = "raw",
  PROCESSED = "processed",
  CRAFTABLE = "craftable",
  SPECIAL = "special",
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

/**
 * Type representing all possible weapon ID values.
 */
export type WeaponIdValue = `${WeaponId}`;

/**
 * Type representing all possible item tier values.
 */
export type ItemTierValue = `${ItemTier}`;

/**
 * Type representing all possible workstation type values.
 */
export type WorkstationTypeValue = `${WorkstationType}`;

/**
 * Type representing all possible skill type values.
 */
export type SkillTypeValue = `${SkillType}`;

/**
 * Type representing all possible tool type values.
 */
export type ToolTypeValue = `${ToolType}`;

/**
 * Array of all weapon IDs for iteration.
 */
export const ALL_WEAPON_IDS: readonly WeaponId[] = Object.values(
  WeaponId,
) as WeaponId[];

/**
 * Array of all item tiers for iteration.
 */
export const ALL_ITEM_TIERS: readonly ItemTier[] = Object.values(
  ItemTier,
) as ItemTier[];

/**
 * Array of all workstation types for iteration.
 */
export const ALL_WORKSTATION_TYPES: readonly WorkstationType[] = Object.values(
  WorkstationType,
) as WorkstationType[];

/**
 * Array of all skill types for iteration.
 */
export const ALL_SKILL_TYPES: readonly SkillType[] = Object.values(
  SkillType,
) as SkillType[];

/**
 * Array of all tool types for iteration.
 */
export const ALL_TOOL_TYPES: readonly ToolType[] = Object.values(
  ToolType,
) as ToolType[];

/**
 * Type guard to check if a string is a valid WeaponId.
 */
export function isWeaponId(value: string): value is WeaponId {
  return Object.values(WeaponId).includes(value as WeaponId);
}

/**
 * Type guard to check if a string is a valid ItemTier.
 */
export function isItemTier(value: string): value is ItemTier {
  return Object.values(ItemTier).includes(value as ItemTier);
}

/**
 * Type guard to check if a string is a valid WorkstationType.
 */
export function isWorkstationType(value: string): value is WorkstationType {
  return Object.values(WorkstationType).includes(value as WorkstationType);
}

/**
 * Type guard to check if a string is a valid SkillType.
 */
export function isSkillType(value: string): value is SkillType {
  return Object.values(SkillType).includes(value as SkillType);
}

/**
 * Type guard to check if a string is a valid ToolType.
 */
export function isToolType(value: string): value is ToolType {
  return Object.values(ToolType).includes(value as ToolType);
}
