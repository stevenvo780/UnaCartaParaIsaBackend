/**
 * Configuration constants for the simulation system.
 *
 * @deprecated This file has been consolidated into SimulationConstants.ts.
 * Please import from there instead. This file is kept for backward compatibility only.
 *
 * @module shared/constants/ConfigConstants
 */

// Re-export from consolidated location
export {
  DEFAULT_WORK_DURATION_MS,
  DEFAULT_BASE_YIELD,
  DEFAULT_TICK_INTERVAL_MS,
  MAX_COMMAND_QUEUE_SIZE,
  DEFAULT_AGENT_SPAWN_CONFIG,
  DEFAULT_INVENTORY_CAPACITY,
  DEFAULT_STOCKPILE_CAPACITY,
  RESOURCE_CONSUMPTION_RATES,
  RESOURCE_REGENERATION_RATES,
  DEFAULT_AI_DECISION_INTERVAL_MS,
  DEFAULT_GOAL_TIMEOUT_MS,
  MIN_PRIORITY_THRESHOLD,
  DEFAULT_AI_BATCH_SIZE,
} from "./SimulationConstants";
