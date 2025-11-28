/**
 * Appearance-related enumerations for the simulation system.
 *
 * Defines visual style IDs for different generations.
 *
 * @module shared/constants/AppearanceEnums
 */

/**
 * Enumeration of generation visual style IDs.
 */
export enum GenerationStyleId {
  DIVINE_GEN0 = "divine_gen0",
  PIONEER_GEN1 = "pioneer_gen1",
  CRAFTERS_GEN2 = "crafters_gen2",
  SCHOLARS_GEN3 = "scholars_gen3",
  WARRIORS_GEN4 = "warriors_gen4",
  MIXED_GEN5 = "mixed_gen5",
}

/**
 * Type representing all possible generation style ID values.
 */
export type GenerationStyleIdValue = `${GenerationStyleId}`;

/**
 * Array of all generation style IDs for iteration.
 */
export const ALL_GENERATION_STYLE_IDS: readonly GenerationStyleId[] =
  Object.values(GenerationStyleId) as GenerationStyleId[];

/**
 * Type guard to check if a string is a valid GenerationStyleId.
 */
export function isGenerationStyleId(value: string): value is GenerationStyleId {
  return Object.values(GenerationStyleId).includes(value as GenerationStyleId);
}
