/**
 * Constantes centralizadas para el sistema de simulación.
 * Elimina valores mágicos dispersos en el código.
 *
 * MIGRACIÓN GRADUAL: Los sistemas individuales (MovementSystem, AnimalSystem, etc.)
 * tienen sus propias constantes locales que eventualmente deberían migrar aquí.
 *
 * Uso:
 * import { SIM_CONSTANTS } from '../core/SimulationConstants';
 * const interval = SIM_CONSTANTS.TICK_INTERVAL_MS;
 */
export const SIM_CONSTANTS = {
  // === Intervalos de actualización ===
  TICK_INTERVAL_MS: 200,
  DEFAULT_UPDATE_INTERVAL_MS: 1000,
  AI_UPDATE_INTERVAL_MS: 1000,
  COMBAT_DECISION_INTERVAL_MS: 750,
  MEMORY_CLEANUP_INTERVAL_MS: 300000,
  CACHE_CLEANUP_INTERVAL_MS: 30000,

  // === Cache TTLs ===
  DEFAULT_CACHE_TTL: 15000,
  PATH_CACHE_DURATION: 30000,
  GRID_CACHE_DURATION: 30000,
  ZONE_CACHE_TTL: 15000,

  // === Límites de batch/queue ===
  MAX_AGENTS_PER_BATCH: 10,
  MAX_COMMAND_QUEUE: 200,
  MAX_LOG_ENTRIES: 200,

  // === Configuración espacial ===
  SPATIAL_CELL_SIZE: 256,
  ENGAGEMENT_RADIUS: 70,
  PROXIMITY_RADIUS: 100,
  DEFAULT_CELL_SIZE: 70,

  // === Límites de memoria ===
  MAX_MEMORY_ITEMS: 50,
  MAX_VISITED_ZONES: 100,
  MAX_SUCCESSFUL_ACTIVITIES: 50,

  // === Stagger para evitar spikes ===
  STAGGER_OFFSET_MS: 50,

  // === Umbrales de necesidades ===
  CRITICAL_THRESHOLD: 20,
  EMERGENCY_THRESHOLD: 10,
  DEFAULT_NEED_VALUE: 100,

  // === Movimiento (valores base, MovementSystem puede override) ===
  BASE_MOVEMENT_SPEED: 80,
  FATIGUE_PENALTY_MULTIPLIER: 0.5,
  PATHFINDING_TIMEOUT_MS: 50,
  PATHFINDING_MAX_ITERATIONS: 500,
  PATHFINDING_GRID_SIZE: 32,

  // === Animales ===
  MAX_ANIMALS: 500,
  SPAWN_RADIUS: 300,
  ANIMAL_UPDATE_INTERVAL: 1000,
  ANIMAL_CLEANUP_INTERVAL: 30000,

  // === Inventario/Almacenamiento ===
  DEFAULT_AGENT_CAPACITY: 50,
  DEFAULT_STOCKPILE_CAPACITY: 1000,
  FOOD_DECAY_RATE: 0.02,
  WATER_DECAY_RATE: 0.01,
  DEPRECATION_INTERVAL: 10000,
} as const;

/** Tipo para acceder a las constantes con type safety */
export type SimConstantsType = typeof SIM_CONSTANTS;
