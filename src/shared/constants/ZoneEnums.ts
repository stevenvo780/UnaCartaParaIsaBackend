/**
 * Zone type enumerations for the simulation system.
 *
 * Defines all zone types and stockpile types used in building and zone management.
 *
 * @module shared/constants/ZoneEnums
 */

/**
 * Enumeration of all zone types available in the simulation.
 * Zones define the purpose and functionality of areas within buildings.
 */
export enum ZoneType {
  KITCHEN = "kitchen",
  BEDROOM = "bedroom",
  LIVING = "living",
  BATHROOM = "bathroom",
  OFFICE = "office",
  GYM = "gym",
  LIBRARY = "library",
  SOCIAL = "social",
  RECREATION = "recreation",
  FOOD = "food",
  WATER = "water",
  SHELTER = "shelter",
  REST = "rest",
  PLAY = "play",
  COMFORT = "comfort",
  WORK = "work",
  ENERGY = "energy",
  HYGIENE = "hygiene",
  ENTERTAINMENT = "entertainment",
  FUN = "fun",
  MEDICAL = "medical",
  EDUCATION = "education",
  TRAINING = "training",
  KNOWLEDGE = "knowledge",
  MARKET = "market",
  SPIRITUAL = "spiritual",
  SECURITY = "security",
  STORAGE = "storage",
  DEFENSE = "defense",
  BATH = "bath",
  WELL = "well",
  GATHERING = "gathering",
  TAVERN = "tavern",
  FESTIVAL = "festival",
  TEMPLE = "temple",
  SANCTUARY = "sanctuary",
}

/**
 * Enumeration of stockpile types for resource storage.
 */
export enum StockpileType {
  GENERAL = "general",
  FOOD = "food",
  MATERIALS = "materials",
}

/**
 * Type representing all possible zone type values.
 */
export type ZoneTypeValue = `${ZoneType}`;

/**
 * Type representing all possible stockpile type values.
 */
export type StockpileTypeValue = `${StockpileType}`;

/**
 * Array of all zone types for iteration.
 */
export const ALL_ZONE_TYPES: readonly ZoneType[] = Object.values(
  ZoneType,
) as ZoneType[];

/**
 * Array of all stockpile types for iteration.
 */
export const ALL_STOCKPILE_TYPES: readonly StockpileType[] = Object.values(
  StockpileType,
) as StockpileType[];

/**
 * Type guard to check if a string is a valid ZoneType.
 */
export function isZoneType(value: string): value is ZoneType {
  return Object.values(ZoneType).includes(value as ZoneType);
}

/**
 * Type guard to check if a string is a valid StockpileType.
 */
export function isStockpileType(value: string): value is StockpileType {
  return Object.values(StockpileType).includes(value as StockpileType);
}
