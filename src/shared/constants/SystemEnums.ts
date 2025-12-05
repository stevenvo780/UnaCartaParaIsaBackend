/**
 * System status enumerations for the simulation system.
 *
 * Defines all system status values used to track the state of systems,
 * components, and services throughout the application.
 *
 * @module shared/constants/SystemEnums
 */

/**
 * Enumeration of system status values.
 */
export enum SystemStatus {
  READY = "ready",
  INITIALIZING = "initializing",
  RUNNING = "running",
  STOPPED = "stopped",
  ERROR = "error",
  DISABLED = "disabled",
}

/**
 * Enumeration of common system property names.
 */
export enum SystemProperty {
  STATS = "stats",
  STATE = "state",
  CONFIG = "config",
  METADATA = "metadata",
  INVENTORY = "inventory",
  TREND = "trend",
  TRAITS = "traits",
  SEX = "sex",
  RESOLUTION = "resolution",
  ASSETS = "assets",
  MATERIALS = "materials",
  RESOURCES = "resources",
}

/**
 * Enumeration of system names for identifying simulation systems.
 */
export enum SystemName {
  MOVEMENT = "movement",
  NEEDS = "needs",
  BUILDING = "building",
  COMBAT = "combat",
  SOCIAL = "social",
  CRAFTING = "crafting",
  INVENTORY = "inventory",
  WORLD_QUERY = "worldQuery",
  TRADE = "trade",
}

/**
 * Enumeration of snapshot types.
 */
export enum SnapshotType {
  FULL = "full",
  DELTA = "delta",
}

/**
 * Type representing all possible system status values.
 */
