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

/**
 * Enumeration of zone IDs used in world configuration.
 */
export enum ZoneID {
  FOOD_ZONE_CENTRAL = "food_zone_central",
  WATER_ZONE_NORTH = "water_zone_north",
  REST_ZONE_SOUTH = "rest_zone_south",
  WORK_ZONE_LOGGING = "work_zone_logging",
  WORK_ZONE_QUARRY = "work_zone_quarry",
  STORAGE_GRANARY_01 = "storage_granary_01",
  WATER_WELL_CENTRAL = "water_well_central",
  FOOD_ZONE_ORCHARD_EAST = "food_zone_orchard_east",
  FOOD_ZONE_FARM_WEST = "food_zone_farm_west",
  FOOD_ZONE_GARDEN_SOUTH = "food_zone_garden_south",
  WATER_ZONE_LAKE_EAST = "water_zone_lake_east",
  WATER_ZONE_SPRING_WEST = "water_zone_spring_west",
  DEFENSE_TOWER_NORTH = "defense_tower_north",
  DIVINE_TEMPLE_CENTER = "divine_temple_center",
  MEDICAL_ZONE_HOSPITAL = "medical_zone_hospital",
  TRAINING_ZONE_GYM = "training_zone_gym",
  KNOWLEDGE_ZONE_LIBRARY = "knowledge_zone_library",
  SPIRITUAL_ZONE_TEMPLE = "spiritual_zone_temple",
  MARKET_ZONE_PLAZA = "market_zone_plaza",
}

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
