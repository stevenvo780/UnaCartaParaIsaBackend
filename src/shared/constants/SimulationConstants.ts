/**
 * Consolidated simulation constants.
 *
 * This is the single source of truth for all simulation constants.
 * Previously scattered across (now consolidated):
 * - domain/simulation/core/SimulationConstants.ts (legacy - removed)
 * - shared/constants/ConfigConstants.ts (legacy - removed)
 *
 * Constants are organized by domain for better maintainability and clarity.
 *
 * @module shared/constants/SimulationConstants
 */

import { ResourceType } from "./ResourceEnums";

/**
 * Consolidated simulation constants organized by domain.
 */
export const SIMULATION_CONSTANTS = {
  /**
   * Timing and interval constants.
   */
  TIMING: {
    /** Main simulation tick interval in milliseconds (5Hz = 200ms). */
    TICK_INTERVAL_MS: 200,
    /** Default update interval for general systems in milliseconds. */
    DEFAULT_UPDATE_INTERVAL_MS: 1000,
    /** AI system update interval in milliseconds. */
    AI_UPDATE_INTERVAL_MS: 1000,
    /** AI decision interval in milliseconds (same as AI_UPDATE_INTERVAL_MS). */
    AI_DECISION_INTERVAL_MS: 1000,
    /** Combat system decision interval in milliseconds. */
    COMBAT_DECISION_INTERVAL_MS: 750,
    /** Memory cleanup interval in milliseconds (5 minutes). */
    MEMORY_CLEANUP_INTERVAL_MS: 300000,
    /** Cache cleanup interval in milliseconds (30 seconds). */
    CACHE_CLEANUP_INTERVAL_MS: 30000,
    /** Animal system update interval in milliseconds. */
    ANIMAL_UPDATE_INTERVAL_MS: 1000,
    /** Animal cleanup interval in milliseconds (30 seconds). */
    ANIMAL_CLEANUP_INTERVAL_MS: 30000,
    /** Default work duration in milliseconds (5 seconds). */
    DEFAULT_WORK_DURATION_MS: 5000,
    /** Default goal timeout in milliseconds (30 seconds). */
    DEFAULT_GOAL_TIMEOUT_MS: 30000,
    /** Stagger offset for batch processing in milliseconds. */
    STAGGER_OFFSET_MS: 50,
    /** Deprecation check interval in milliseconds (10 seconds). */
    DEPRECATION_INTERVAL_MS: 10000,
  } as const,

  /**
   * Cache and TTL constants.
   */
  CACHE: {
    /** Default cache TTL in milliseconds (15 seconds). */
    DEFAULT_TTL_MS: 15000,
    /** Path cache duration in milliseconds (30 seconds). */
    PATH_CACHE_DURATION_MS: 30000,
    /** Grid cache duration in milliseconds (30 seconds). */
    GRID_CACHE_DURATION_MS: 30000,
    /** Zone cache TTL in milliseconds (15 seconds). */
    ZONE_CACHE_TTL_MS: 15000,
  } as const,

  /**
   * Batch processing and queue limits.
   */
  BATCH: {
    /** Maximum agents processed per batch. */
    MAX_AGENTS_PER_BATCH: 10,
    /** Maximum command queue size. */
    MAX_COMMAND_QUEUE: 200,
    /** Maximum command queue size (alternative name, kept for compatibility). */
    MAX_COMMAND_QUEUE_SIZE: 1000,
    /** Maximum log entries. */
    MAX_LOG_ENTRIES: 200,
    /** Default AI batch size. */
    DEFAULT_AI_BATCH_SIZE: 50,
  } as const,

  /**
   * Spatial and grid constants.
   */
  SPATIAL: {
    /** Spatial grid cell size. */
    CELL_SIZE: 256,
    /** Default cell size for spatial queries. */
    DEFAULT_CELL_SIZE: 70,
    /** Engagement radius for combat and interactions. */
    ENGAGEMENT_RADIUS: 70,
    /** Proximity radius for nearby entity detection. */
    PROXIMITY_RADIUS: 100,
    /** Harvest range for resource gathering. */
    HARVEST_RANGE: 80,
    /** Attack range for combat. */
    ATTACK_RANGE: 50,
    /** Exploration range for agents. */
    EXPLORE_RANGE: 200,
    /** Water detection distance. */
    WATER_DETECTION_DISTANCE: 60,
    /** Crop spacing in tiles. */
    CROP_SPACING: 32,
    /** Spawn radius for entities. */
    SPAWN_RADIUS: 300,
  } as const,

  /**
   * Memory and activity limits.
   */
  MEMORY: {
    /** Maximum memory items an agent can remember. */
    MAX_MEMORY_ITEMS: 50,
    /** Maximum visited zones an agent can track. */
    MAX_VISITED_ZONES: 100,
    /** Maximum successful activities an agent can remember. */
    MAX_SUCCESSFUL_ACTIVITIES: 50,
  } as const,

  /**
   * Needs system thresholds.
   */
  NEEDS: {
    /** Critical threshold for needs (20%). */
    CRITICAL_THRESHOLD: 20,
    /** Emergency threshold for needs (10%). */
    EMERGENCY_THRESHOLD: 10,
    /** Default need value when initialized (100%). */
    DEFAULT_NEED_VALUE: 100,
    /** High threshold for needs (80%). */
    HIGH_THRESHOLD: 80,
    /** Medium threshold for needs (60%). */
    MEDIUM_THRESHOLD: 60,
    /** Low threshold for needs (30%). */
    LOW_THRESHOLD: 30,
    /** Satisfied threshold for needs (70%). */
    SATISFIED_THRESHOLD: 70,
    /** Urgent threshold (triggers action) = 50% */
    URGENT_THRESHOLD: 50,
    /** Minimum priority threshold for AI goals. */
    MIN_PRIORITY_THRESHOLD: 0.1,
  } as const,

  /**
   * Combat system thresholds.
   */
  COMBAT: {
    /** Health ratio below which agent should flee (20%). */
    FLEE_HEALTH_THRESHOLD: 0.2,
    /** Health ratio to trigger threat alert (30%). */
    THREAT_ALERT_THRESHOLD: 0.3,
    /** Distance at which to flee from predators (80 units). */
    PREDATOR_FLEE_DISTANCE: 80,
    /** Attack cooldown in milliseconds. */
    ATTACK_COOLDOWN_MS: 1000,
    /** Damage multiplier base. */
    BASE_DAMAGE_MULTIPLIER: 1.0,
  } as const,

  /**
   * Inventory system thresholds.
   */
  INVENTORY_THRESHOLDS: {
    /** Capacity ratio to trigger deposit (70%). */
    DEPOSIT_THRESHOLD: 0.7,
    /** Urgent capacity ratio for immediate deposit (90%). */
    URGENT_DEPOSIT_THRESHOLD: 0.9,
  } as const,

  /**
   * Social system thresholds.
   */
  SOCIAL: {
    /** Wellness threshold for reproduction (80%). */
    REPRODUCTION_WELLNESS_THRESHOLD: 0.8,
    /** Minimum social need for interaction (30%). */
    SOCIAL_INTERACTION_THRESHOLD: 30,
  } as const,

  /**
   * AI Priority values.
   */
  PRIORITIES: {
    /** Critical priority (highest). */
    CRITICAL: 0.95,
    /** Urgent priority. */
    URGENT: 0.8,
    /** High priority. */
    HIGH: 0.6,
    /** Normal priority. */
    NORMAL: 0.4,
    /** Low priority. */
    LOW: 0.2,
  } as const,

  /**
   * Movement and pathfinding constants.
   */
  MOVEMENT: {
    /** Base movement speed. */
    BASE_SPEED: 80,
    /** Fatigue penalty multiplier for movement. */
    FATIGUE_PENALTY_MULTIPLIER: 0.5,
    /** Pathfinding timeout in milliseconds. */
    PATHFINDING_TIMEOUT_MS: 50,
    /** Maximum iterations for pathfinding algorithm. */
    PATHFINDING_MAX_ITERATIONS: 500,
    /** Grid size for pathfinding. */
    PATHFINDING_GRID_SIZE: 32,
    /** Idle wander cooldown in milliseconds. */
    IDLE_WANDER_COOLDOWN_MS: 600,
    /** Probability of idle wandering (0.85 = 85%). */
    IDLE_WANDER_PROBABILITY: 0.85,
    /** Minimum radius for idle wandering. */
    IDLE_WANDER_RADIUS_MIN: 80,
    /** Maximum radius for idle wandering. */
    IDLE_WANDER_RADIUS_MAX: 280,
    /** Probability of exploration during idle wander (0.35 = 35%). */
    IDLE_WANDER_EXPLORATION_PROBABILITY: 0.35,
    /** Minimum radius for exploration during idle wander. */
    IDLE_WANDER_EXPLORATION_RADIUS_MIN: 400,
    /** Maximum radius for exploration during idle wander. */
    IDLE_WANDER_EXPLORATION_RADIUS_MAX: 900,
  } as const,

  /**
   * Animal system constants.
   */
  ANIMALS: {
    /** Maximum number of animals in the simulation. */
    MAX_ANIMALS: 500,
  } as const,

  /**
   * Inventory and capacity constants.
   */
  INVENTORY: {
    /** Default agent inventory capacity. */
    DEFAULT_AGENT_CAPACITY: 50,
    /** Default inventory capacity for general use. */
    DEFAULT_INVENTORY_CAPACITY: 100,
    /** Default stockpile capacity. */
    DEFAULT_STOCKPILE_CAPACITY: 1000,
  } as const,

  /**
   * Resource decay and consumption rates.
   */
  RESOURCES: {
    /** Food decay rate per tick. */
    FOOD_DECAY_RATE: 0.02,
    /** Water decay rate per tick. */
    WATER_DECAY_RATE: 0.01,
    /** Resource consumption rates per tick. */
    CONSUMPTION_RATES: {
      [ResourceType.FOOD]: 0.001,
      [ResourceType.WATER]: 0.002,
    } as Readonly<Partial<Record<ResourceType, number>>>,
    /** Resource regeneration rates per tick. */
    REGENERATION_RATES: {
      [ResourceType.WOOD]: 0.0001,
      [ResourceType.STONE]: 0.00005,
      [ResourceType.FOOD]: 0.0002,
      [ResourceType.WATER]: 0.0005,
    } as Readonly<Partial<Record<ResourceType, number>>>,
    /** Default base yield for resources. */
    DEFAULT_BASE_YIELD: {
      [ResourceType.WOOD]: 1,
      [ResourceType.STONE]: 1,
      [ResourceType.FOOD]: 1,
      [ResourceType.WATER]: 1,
      [ResourceType.RARE_MATERIALS]: 0.1,
      [ResourceType.METAL]: 0.5,
    } as Readonly<Record<ResourceType, number>>,
  } as const,

  /**
   * Agent spawn configuration.
   */
  AGENT_SPAWN: {
    /** Default age for spawned agents. */
    DEFAULT_AGE: 25,
    /** Default generation for spawned agents. */
    DEFAULT_GENERATION: 1,
    /** Default immortal flag for spawned agents. */
    IMMORTAL: false,
  } as const,
} as const;
