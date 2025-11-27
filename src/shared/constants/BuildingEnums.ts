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
