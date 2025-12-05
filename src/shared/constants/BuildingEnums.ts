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
 * Enumeration of building sprite IDs used for rendering.
 */
export enum BuildingSpriteId {
  AGENT_BUILT_HOUSE = "agent_built_house",
  AGENT_BUILT_MINE = "agent_built_mine",
  AGENT_BUILT_WORKBENCH = "agent_built_workbench",
  AGENT_BUILT_FARM = "agent_built_farm",
  AGENT_BUILT_WORKSHOP = "agent_built_workshop",
  AGENT_BUILT_WATCHTOWER = "agent_built_watchtower",
  AGENT_BUILT_STORAGE = "agent_built_storage",
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
 * Enumeration of building sprite IDs used for rendering.
 * Maps building types to their visual asset identifiers.
 */
export enum BuildingSpriteId {
  AGENT_BUILT_HOUSE = "agent_built_house",
  AGENT_BUILT_MINE = "agent_built_mine",
  AGENT_BUILT_WORKBENCH = "agent_built_workbench",
  AGENT_BUILT_FARM = "agent_built_farm",
  AGENT_BUILT_WORKSHOP = "agent_built_workshop",
  AGENT_BUILT_WATCHTOWER = "agent_built_watchtower",
  AGENT_BUILT_STORAGE = "agent_built_storage",
}
