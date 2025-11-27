/**
 * Building type enumerations for the simulation system.
 *
 * Defines all building types used in the simulation.
 *
 * @module shared/constants/BuildingEnums
 */

/**
 * Enumeration of building types available in the simulation.
 */
export enum BuildingType {
  HOUSE = "house",
  MINE = "mine",
  WORKBENCH = "workbench",
  FARM = "farm",
  WORKSHOP = "workshop",
  WATCHTOWER = "watchtower",
}

/**
 * Type representing all possible building type values.
 */
export type BuildingTypeValue = `${BuildingType}`;

/**
 * Array of all building types for iteration.
 */
export const ALL_BUILDING_TYPES: readonly BuildingType[] = Object.values(
  BuildingType,
) as BuildingType[];

/**
 * Type guard to check if a string is a valid BuildingType.
 */
export function isBuildingType(value: string): value is BuildingType {
  return Object.values(BuildingType).includes(value as BuildingType);
}

/**
 * Enumeration of building condition levels.
 * Defines the state of repair and usability of buildings.
 */
export enum BuildingCondition {
  PRISTINE = "pristine",
  GOOD = "good",
  FAIR = "fair",
  POOR = "poor",
  CRITICAL = "critical",
  RUINED = "ruined",
}

/**
 * Type representing all possible building condition values.
 */
export type BuildingConditionValue = `${BuildingCondition}`;

/**
 * Array of all building conditions for iteration.
 */
export const ALL_BUILDING_CONDITIONS: readonly BuildingCondition[] =
  Object.values(BuildingCondition) as BuildingCondition[];

/**
 * Type guard to check if a string is a valid BuildingCondition.
 */
export function isBuildingCondition(value: string): value is BuildingCondition {
  return Object.values(BuildingCondition).includes(value as BuildingCondition);
}

/**
 * Enumeration of building sprite IDs used for rendering.
 * These correspond to sprite keys for different building types and zones.
 */
export enum BuildingSpriteId {
  AGENT_BUILT_SHELTER = "agent_built_shelter",
  AGENT_BUILT_BEDROOM = "agent_built_bedroom",
  AGENT_BUILT_LIVING = "agent_built_living",
  AGENT_BUILT_BATHROOM = "agent_built_bathroom",
  AGENT_BUILT_WORKBENCH = "agent_built_workbench",
  AGENT_BUILT_KITCHEN = "agent_built_kitchen",
  AGENT_BUILT_OFFICE = "agent_built_office",
  AGENT_BUILT_MEDICAL = "agent_built_medical",
  AGENT_BUILT_GYM = "agent_built_gym",
  AGENT_BUILT_HOUSE = "agent_built_house",
  AGENT_BUILT_LIBRARY = "agent_built_library",
  AGENT_BUILT_EDUCATION = "agent_built_education",
  AGENT_BUILT_TRAINING = "agent_built_training",
  AGENT_BUILT_KNOWLEDGE = "agent_built_knowledge",
  AGENT_BUILT_SOCIAL = "agent_built_social",
  AGENT_BUILT_RECREATION = "agent_built_recreation",
  AGENT_BUILT_ENTERTAINMENT = "agent_built_entertainment",
  AGENT_BUILT_FUN = "agent_built_fun",
  AGENT_BUILT_PLAY = "agent_built_play",
  AGENT_BUILT_FOOD = "agent_built_food",
  AGENT_BUILT_WATER = "agent_built_water",
  AGENT_BUILT_STORAGE = "agent_built_storage",
  AGENT_BUILT_MARKET = "agent_built_market",
  AGENT_BUILT_DEFENSE = "agent_built_defense",
  AGENT_BUILT_SECURITY = "agent_built_security",
  AGENT_BUILT_SPIRITUAL = "agent_built_spiritual",
  AGENT_BUILT_ENERGY = "agent_built_energy",
  AGENT_BUILT_HYGIENE = "agent_built_hygiene",
  AGENT_BUILT_COMFORT = "agent_built_comfort",
  AGENT_BUILT_WELL = "agent_built_well",
  AGENT_BUILT_TAVERN = "agent_built_tavern",
  AGENT_BUILT_MINE = "agent_built_mine",
}

/**
 * Type representing all possible building sprite ID values.
 */
export type BuildingSpriteIdValue = `${BuildingSpriteId}`;

/**
 * Array of all building sprite IDs for iteration.
 */
export const ALL_BUILDING_SPRITE_IDS: readonly BuildingSpriteId[] = Object.values(
  BuildingSpriteId,
) as BuildingSpriteId[];

/**
 * Type guard to check if a string is a valid BuildingSpriteId.
 */
export function isBuildingSpriteId(value: string): value is BuildingSpriteId {
  return Object.values(BuildingSpriteId).includes(value as BuildingSpriteId);
}
