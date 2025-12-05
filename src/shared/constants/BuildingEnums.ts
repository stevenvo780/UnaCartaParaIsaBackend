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
  STORAGE = "storage",
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
