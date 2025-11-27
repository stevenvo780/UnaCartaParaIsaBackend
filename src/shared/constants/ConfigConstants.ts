/**
 * Configuration constants for the simulation system.
 *
 * Centralizes all configuration values that are used across multiple modules.
 * These constants are typed and use `as const` to ensure type safety.
 *
 * @module shared/constants/ConfigConstants
 */

import { ResourceType } from "./ResourceEnums";

/**
 * Default work duration in milliseconds.
 */
export const DEFAULT_WORK_DURATION_MS = 5000 as const;

/**
 * Default base yield for resources.
 */
export const DEFAULT_BASE_YIELD: Readonly<Record<ResourceType, number>> = {
  [ResourceType.WOOD]: 1,
  [ResourceType.STONE]: 1,
  [ResourceType.FOOD]: 1,
  [ResourceType.WATER]: 1,
  [ResourceType.RARE_MATERIALS]: 0.1,
  [ResourceType.METAL]: 0.5,
} as const;

/**
 * Default tick interval in milliseconds (50Hz = 20ms).
 */
export const DEFAULT_TICK_INTERVAL_MS = 20 as const;

/**
 * Maximum command queue size.
 */
export const MAX_COMMAND_QUEUE_SIZE = 1000 as const;

/**
 * Default agent spawn configuration.
 */
export const DEFAULT_AGENT_SPAWN_CONFIG = {
  defaultAge: 25,
  defaultGeneration: 1,
  immortal: false,
} as const;

/**
 * Default inventory capacity.
 */
export const DEFAULT_INVENTORY_CAPACITY = 100 as const;

/**
 * Default stockpile capacity.
 */
export const DEFAULT_STOCKPILE_CAPACITY = 1000 as const;

/**
 * Resource consumption rates (per tick).
 */
export const RESOURCE_CONSUMPTION_RATES: Readonly<
  Partial<Record<ResourceType, number>>
> = {
  [ResourceType.FOOD]: 0.001,
  [ResourceType.WATER]: 0.002,
} as const;

/**
 * Resource regeneration rates (per tick).
 */
export const RESOURCE_REGENERATION_RATES: Readonly<
  Partial<Record<ResourceType, number>>
> = {
  [ResourceType.WOOD]: 0.0001,
  [ResourceType.STONE]: 0.00005,
  [ResourceType.FOOD]: 0.0002,
  [ResourceType.WATER]: 0.0005,
} as const;

/**
 * Default AI decision interval in milliseconds.
 */
export const DEFAULT_AI_DECISION_INTERVAL_MS = 1000 as const;

/**
 * Default goal timeout in milliseconds.
 */
export const DEFAULT_GOAL_TIMEOUT_MS = 30000 as const;

/**
 * Minimum priority threshold for AI goals.
 */
export const MIN_PRIORITY_THRESHOLD = 0.1 as const;

/**
 * Default batch size for AI processing.
 */
export const DEFAULT_AI_BATCH_SIZE = 50 as const;
