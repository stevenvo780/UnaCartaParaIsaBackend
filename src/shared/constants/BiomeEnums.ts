/**
 * Biome type enumerations for the simulation system.
 *
 * Defines all biome types used in world generation and terrain management.
 * This module ensures consistency between backend and frontend biome definitions.
 *
 * @module shared/constants/BiomeEnums
 */

/**
 * Enumeration of all biome types in the simulation.
 * Biomes define the environmental characteristics of different areas.
 */
export enum BiomeType {
  GRASSLAND = "grassland",
  FOREST = "forest",
  DESERT = "desert",
  TUNDRA = "tundra",
  SWAMP = "swamp",
  MOUNTAIN = "mountain",
  BEACH = "beach",
  OCEAN = "ocean",
  RIVER = "river",
  LAKE = "lake",
  MYSTICAL = "mystical",
  WETLAND = "wetland",
  MOUNTAINOUS = "mountainous",
  VILLAGE = "village",
}

/**
 * Type representing all possible biome type values.
 */
export type BiomeTypeValue = `${BiomeType}`;

/**
 * Array of all biome types for iteration.
 */
export const ALL_BIOME_TYPES: readonly BiomeType[] = Object.values(
  BiomeType,
) as BiomeType[];

/**
 * Type guard to check if a string is a valid BiomeType.
 */
export function isBiomeType(value: string): value is BiomeType {
  return Object.values(BiomeType).includes(value as BiomeType);
}
