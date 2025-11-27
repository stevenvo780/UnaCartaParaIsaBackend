/**
 * Tile type enumerations for the simulation system.
 *
 * Defines all terrain tile types used in world generation and rendering.
 *
 * @module shared/constants/TileTypeEnums
 */

/**
 * Enumeration of terrain tile types.
 */
export enum TileType {
  GRASS = "grass",
  STONE = "stone",
  WATER = "water",
  PATH = "path",
  TERRAIN_DIRT = "terrain_dirt",
  TERRAIN_GRASSLAND = "terrain_grassland",
}

/**
 * Type representing all possible tile type values.
 */
export type TileTypeValue = `${TileType}`;

/**
 * Array of all tile types for iteration.
 */
export const ALL_TILE_TYPES: readonly TileType[] = Object.values(
  TileType,
) as TileType[];

/**
 * Type guard to check if a string is a valid TileType.
 */
export function isTileType(value: string): value is TileType {
  return Object.values(TileType).includes(value as TileType);
}
