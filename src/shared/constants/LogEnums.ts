/**
 * Log level enumerations for the simulation system.
 *
 * Defines all log levels used in the logging system.
 *
 * @module shared/constants/LogEnums
 */

/**
 * Enumeration of log levels.
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Enumeration of log categories for identifying which system generated the log.
 * Useful for filtering and analyzing behavior by subsystem.
 */
export enum LogCategory {
  /** Core simulation runner and scheduler */
  SIMULATION = "simulation",
  /** AI decision-making and behavior trees */
  AI = "ai",
  /** Agent movement and pathfinding */
  MOVEMENT = "movement",
  /** Combat and conflict resolution */
  COMBAT = "combat",
  /** Social interactions and relationships */
  SOCIAL = "social",
  /** Economy, trading, and resources */
  ECONOMY = "economy",
  /** World generation and terrain */
  WORLD = "world",
  /** Item generation and inventory */
  ITEMS = "items",
  /** Animal behavior and spawning */
  ANIMALS = "animals",
  /** Needs system (hunger, energy, etc.) */
  NEEDS = "needs",
  /** Lifecycle events (birth, death, aging) */
  LIFECYCLE = "lifecycle",
  /** Buildings and construction */
  BUILDINGS = "buildings",
  /** Governance and political systems */
  GOVERNANCE = "governance",
  /** Storage and persistence */
  STORAGE = "storage",
  /** Chunk loading and streaming */
  CHUNKS = "chunks",
  /** GPU compute operations */
  GPU = "gpu",
  /** General/uncategorized logs */
  GENERAL = "general",
  /** Performance metrics and profiling */
  PERFORMANCE = "performance",
}

/**
 * Type representing all possible log level values.
 */
// Alias/listas/guards eliminados para que sólo se exporten los enums.
