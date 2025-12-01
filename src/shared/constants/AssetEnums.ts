/**
 * Asset type enumerations for the frontend.
 *
 * Defines all asset types used in asset loading and management.
 *
 * @module constants/AssetEnums
 */

/**
 * Enumeration of asset types available in the asset system.
 */
export enum AssetType {
  IMAGE = "image",
  AUDIO = "audio",
  JSON = "json",
  TILEMAP = "tilemap",
  SPRITESHEET = "spritesheet",
}

/**
 * Enumeration of asset categories.
 */
export enum AssetCategory {
  CHARACTER = "character",
  TERRAIN = "terrain",
  FOOD = "food",
  STRUCTURE = "structure",
  DECORATION = "decoration",
  ANIMATION = "animation",
  AUDIO = "audio",
}

/**
 * Enumeration of asset priority levels.
 */
export enum AssetPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

/**
 * Type representing all possible asset type values.
 */
export type AssetTypeValue = `${AssetType}`;

/**
 * Type representing all possible asset category values.
 */
export type AssetCategoryValue = `${AssetCategory}`;

/**
 * Type representing all possible asset priority values.
 */
export type AssetPriorityValue = `${AssetPriority}`;

/**
 * Array of all asset types for iteration.
 */
export const ALL_ASSET_TYPES: readonly AssetType[] = Object.values(
  AssetType,
) as AssetType[];

/**
 * Type guard to check if a string is a valid AssetType.
 */
export function isAssetType(value: string): value is AssetType {
  return Object.values(AssetType).includes(value as AssetType);
}
