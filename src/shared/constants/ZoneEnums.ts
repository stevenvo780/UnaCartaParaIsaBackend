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
  WILD = "wild",
}

/**
 * Enumeration of stockpile types for resource storage.
 */
export enum StockpileType {
  GENERAL = "general",
  FOOD = "food",
  MATERIALS = "materials",
}

// Identificadores específicos de zonas eliminados por no tener consumidores activos.

/**
 * Type representing all possible zone type values.
 */
/**
 * Array of all zone types for iteration.
 */
export const ALL_ZONE_TYPES: readonly ZoneType[] = Object.values(
  ZoneType,
) as ZoneType[];
// Alias/listas/guards eliminados; sólo se mantiene `ALL_ZONE_TYPES` que es usado
// por `shared/types/simulation/zones`.
