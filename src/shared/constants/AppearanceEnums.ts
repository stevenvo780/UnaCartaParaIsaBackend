/**
 * Appearance-related enumerations for the simulation system.
 *
 * Defines visual styles, clothing, and generation themes for agents.
 *
 * @module shared/constants/AppearanceEnums
 */

/**
 * Enumeration of clothing styles for agents.
 */
export enum ClothingStyle {
  SIMPLE = "simple",
  DECORATED = "decorated",
  ELEGANT = "elegant",
  RUGGED = "rugged",
  MYSTICAL = "mystical",
}

/**
 * Enumeration of generation visual style identifiers.
 */
export enum GenerationStyleId {
  DIVINE_GEN0 = "divine_gen0",
  PIONEER_GEN1 = "pioneer_gen1",
  CRAFTERS_GEN2 = "crafters_gen2",
  SCHOLARS_GEN3 = "scholars_gen3",
  WARRIORS_GEN4 = "warriors_gen4",
  MIXED_GEN5 = "mixed_gen5",
  FOUNDERS = "founders",
  PIONEERS = "pioneers",
  SETTLERS = "settlers",
  BUILDERS = "builders",
  EXPLORERS = "explorers",
  WARRIORS = "warriors",
  SCHOLARS = "scholars",
  ARTISANS = "artisans",
  MYSTICS = "mystics",
  ELDERS = "elders",
}

/**
 * Enumeration of accessory types.
 */
export enum AccessoryType {
  HEADBAND = "headband",
  NECKLACE = "necklace",
  ARMBAND = "armband",
  CAPE = "cape",
  NONE = "none",
}

/**
 * Type representing all possible clothing style values.
 */
export type ClothingStyleValue = `${ClothingStyle}`;

/**
 * Type representing all possible generation style values.
 */
export type GenerationStyleIdValue = `${GenerationStyleId}`;

/**
 * Array of all clothing styles for iteration.
 */
export const ALL_CLOTHING_STYLES: readonly ClothingStyle[] = Object.values(
  ClothingStyle,
) as ClothingStyle[];

/**
 * Array of all generation styles for iteration.
 */
export const ALL_GENERATION_STYLES: readonly GenerationStyleId[] =
  Object.values(GenerationStyleId) as GenerationStyleId[];

/**
 * Type guard to check if a string is a valid ClothingStyle.
 */
export function isClothingStyle(value: string): value is ClothingStyle {
  return Object.values(ClothingStyle).includes(value as ClothingStyle);
}

/**
 * Type guard to check if a string is a valid GenerationStyleId.
 */
export function isGenerationStyleId(value: string): value is GenerationStyleId {
  return Object.values(GenerationStyleId).includes(value as GenerationStyleId);
}
