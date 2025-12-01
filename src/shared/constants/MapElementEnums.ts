/**
 * Map element type enumerations for the frontend.
 *
 * Defines all map element types used in the frontend.
 * These represent different types of elements that can be placed on the map.
 *
 * @module constants/MapElementEnums
 */

/**
 * Enumeration of map element types.
 * Represents different types of elements that can be placed on the world map.
 */
export enum MapElementType {
  OBSTACLE = "obstacle",
  FOOD_ZONE = "food_zone",
  REST_ZONE = "rest_zone",
  PLAY_ZONE = "play_zone",
  SOCIAL_ZONE = "social_zone",
  WORK_ZONE = "work_zone",
  COMFORT_ZONE = "comfort_zone",
  DECORATION = "decoration",
  FOOD_VENDOR = "food_vendor",
  WATER_ZONE = "water_zone",
  MEDICAL_ZONE = "medical_zone",
  TRAINING_ZONE = "training_zone",
  KNOWLEDGE_ZONE = "knowledge_zone",
  MARKET_ZONE = "market_zone",
  SPIRITUAL_ZONE = "spiritual_zone",
  STORAGE_ZONE = "storage_zone",
  DEFENSE_ZONE = "defense_zone",
  TERRAIN = "terrain",
  STRUCTURE = "structure",
  VEGETATION = "vegetation",
}

/**
 * Type representing all possible map element type values.
 */
export type MapElementTypeValue = `${MapElementType}`;

/**
 * Array of all map element types for iteration.
 */
export const ALL_MAP_ELEMENT_TYPES: readonly MapElementType[] = Object.values(
  MapElementType,
) as MapElementType[];

/**
 * Type guard to check if a string is a valid MapElementType.
 */
export function isMapElementType(value: string): value is MapElementType {
  return Object.values(MapElementType).includes(value as MapElementType);
}
