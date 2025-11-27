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
