/**
 * @fileoverview Agent Components - ECS Component Definitions
 *
 * Define todos los componentes que un agente puede tener.
 * Los componentes son datos puros (POJOs), sin lógica.
 *
 * @module domain/simulation/ecs
 */

import type { AgentTask } from "@/shared/types/simulation/unifiedTasks";

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

/**
 * Todos los componentes que un agente puede tener.
 * Cada sistema lee/escribe solo sus propios componentes.
 */
export interface AgentComponents {
  // Core
  id: string;
  profile: ProfileComponent;

  // Vital
  health: HealthComponent;
  needs: NeedsComponent;

  // Spatial
  transform: TransformComponent;
  movement: MovementComponent;

  // Economy
  inventory: InventoryComponent;

  // Combat
  combat: CombatComponent;

  // Work
  role: RoleComponent;

  // Social
  social: SocialComponent;

  // AI
  ai: AIComponent;
}

/**
 * Tipo para acceder a un componente específico
 */
export type ComponentType = keyof AgentComponents;

// ============================================================================
// INDIVIDUAL COMPONENTS
// ============================================================================

/**
 * Perfil básico del agente
 */
export interface ProfileComponent {
  name: string;
  age: number;
  lifeStage: string;
  gender: string;
  traits: string[];
  isDead: boolean;
  deathCause?: string;
}

/**
 * Estado de salud
 */
export interface HealthComponent {
  current: number;
  max: number;
  regeneration: number;
  lastDamageTime: number;
  lastDamageSource?: string;
  isDead: boolean;
}

/**
 * Necesidades vitales (0-100, mayor = más satisfecho)
 */
export interface NeedsComponent {
  hunger: number;
  thirst: number;
  energy: number;
  social: number;
  fun: number;
  hygiene: number;
  mentalHealth: number;
}

/**
 * Posición y orientación en el mundo
 */
export interface TransformComponent {
  x: number;
  y: number;
  rotation: number;
  zoneId?: string;
  biome?: string;
}

/**
 * Estado de movimiento
 */
export interface MovementComponent {
  isMoving: boolean;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  targetEntityId?: string;
  path: Array<{ x: number; y: number }>;
  pathIndex: number;
  speed: number;
  baseSpeed: number;
  fatigue: number;
}

/**
 * Inventario simplificado
 */
export interface InventoryComponent {
  items: Map<string, InventoryItem>;
  capacity: number;
  currentLoad: number;
}

export interface InventoryItem {
  id: string;
  type: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

/**
 * Estado de combate
 */
export interface CombatComponent {
  isInCombat: boolean;
  currentTarget?: string;
  lastAttackTime: number;
  attackCooldown: number;
  baseDamage: number;
  baseDefense: number;
  threatList: Map<string, number>;
  isAggressive: boolean;
}

/**
 * Rol y trabajo
 */
export interface RoleComponent {
  roleType: string;
  workZoneId?: string;
  isOnDuty: boolean;
  workStartHour: number;
  workEndHour: number;
  efficiency: number;
}

/**
 * Estado social
 */
export interface SocialComponent {
  relationships: Map<string, RelationshipData>;
  familyId?: string;
  partnerId?: string;
  mood: number;
  lastSocialInteraction: number;
}

export interface RelationshipData {
  targetId: string;
  type: "family" | "friend" | "enemy" | "neutral" | "partner";
  affinity: number; // -100 to 100
  lastInteraction: number;
}

/**
 * Estado de IA
 */
export interface AIComponent {
  currentTask?: AgentTask;
  taskStartTime?: number;
  lastDecisionTime: number;
  isProcessing: boolean;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Crea componentes por defecto para un nuevo agente
 */
export function createDefaultComponents(
  id: string,
  name: string,
  position: { x: number; y: number },
): Partial<AgentComponents> {
  const now = Date.now();

  return {
    id,
    profile: {
      name,
      age: 20,
      lifeStage: "adult",
      gender: "unknown",
      traits: [],
      isDead: false,
    },
    health: {
      current: 100,
      max: 100,
      regeneration: 0.1,
      lastDamageTime: 0,
      isDead: false,
    },
    needs: {
      hunger: 80,
      thirst: 80,
      energy: 100,
      social: 50,
      fun: 50,
      hygiene: 80,
      mentalHealth: 80,
    },
    transform: {
      x: position.x,
      y: position.y,
      rotation: 0,
    },
    movement: {
      isMoving: false,
      path: [],
      pathIndex: 0,
      speed: 1,
      baseSpeed: 1,
      fatigue: 0,
    },
    inventory: {
      items: new Map(),
      capacity: 20,
      currentLoad: 0,
    },
    combat: {
      isInCombat: false,
      lastAttackTime: 0,
      attackCooldown: 1000,
      baseDamage: 10,
      baseDefense: 5,
      threatList: new Map(),
      isAggressive: false,
    },
    role: {
      roleType: "gatherer",
      isOnDuty: false,
      workStartHour: 8,
      workEndHour: 18,
      efficiency: 1,
    },
    social: {
      relationships: new Map(),
      mood: 50,
      lastSocialInteraction: now,
    },
    ai: {
      lastDecisionTime: now,
      isProcessing: false,
    },
  };
}

/**
 * Clona un componente de forma inmutable
 */
export function cloneComponent<T>(component: T): T {
  if (component instanceof Map) {
    return new Map(component) as unknown as T;
  }
  if (Array.isArray(component)) {
    return [...component] as unknown as T;
  }
  if (typeof component === "object" && component !== null) {
    const cloned = { ...component } as Record<string, unknown>;
    // Deep clone Maps dentro del objeto
    for (const key of Object.keys(cloned)) {
      if (cloned[key] instanceof Map) {
        cloned[key] = new Map(cloned[key] as Map<unknown, unknown>);
      }
    }
    return cloned as T;
  }
  return component;
}
