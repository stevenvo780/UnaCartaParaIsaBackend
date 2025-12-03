/**
 * @fileoverview Tipos unificados para el sistema de IA - ECS Compatible
 *
 * Define todos los tipos necesarios para:
 * - Tareas (Task)
 * - Contexto de detectores (solo lectura)
 * - Contexto de handlers (delegación a sistemas)
 *
 * Arquitectura:
 * - Detectores: observan estado → generan tareas
 * - Handlers: validan y delegan a sistemas via SystemRegistry
 * - Sistemas: implementan lógica de negocio, actualizan ECS
 *
 * @module domain/simulation/systems/agents/ai/types
 */

import { NeedType, GoalType, ActionType } from "@/shared/constants/AIEnums";
import type { HandlerResult, SystemRegistry } from "../SystemRegistry";
import type { EventBus } from "@/domain/simulation/core/EventBus";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

export type { HandlerResult } from "../SystemRegistry";

/**
 * Tipos de tarea que un agente puede realizar
 */
export enum TaskType {
  SATISFY_NEED = GoalType.SATISFY_NEED,
  REST = "rest",

  GATHER = "gather",
  DEPOSIT = "deposit",
  CRAFT = "craft",
  BUILD = "build",
  HUNT = "hunt",
  TRADE = "trade",

  ATTACK = "attack",
  FLEE = "flee",

  SOCIALIZE = ActionType.SOCIALIZE,
  ASSIST = "assist",

  EXPLORE = "explore",

  IDLE = "idle",
}

/**
 * Type representing all possible task type values.
 */
export type TaskTypeValue = `${TaskType}`;

/**
 * Array of all task types for iteration.
 */
export const ALL_TASK_TYPES: readonly TaskType[] = Object.values(
  TaskType,
) as TaskType[];

/**
 * Type guard to check if a string is a valid TaskType.
 */
export function isTaskType(value: string): value is TaskType {
  return Object.values(TaskType).includes(value as TaskType);
}

/**
 * Estado de una tarea
 */
export enum TaskStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = HandlerResultStatus.COMPLETED,
  FAILED = HandlerResultStatus.FAILED,
  CANCELLED = "cancelled",
}

/**
 * Objetivo de una tarea
 */
export interface TaskTarget {
  entityId?: string;
  position?: { x: number; y: number };
  zoneId?: string;
}

/**
 * Parámetros adicionales de una tarea
 */
export interface TaskParams {
  needType?: NeedType | string;
  resourceType?: string;
  itemId?: string;
  buildingId?: string;
  targetAgentId?: string;
  amount?: number;
  duration?: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Tarea de agente
 */
export interface Task {
  id: string;
  agentId: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  target?: TaskTarget;
  params?: TaskParams;
  source: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * Parámetros para crear una tarea
 */
export interface CreateTaskParams {
  agentId: string;
  type: TaskType;
  priority: number;
  target?: TaskTarget;
  params?: TaskParams;
  source: string;
  ttlMs?: number;
}

/**
 * Prioridades estándar de tareas
 */
export const TASK_PRIORITIES = {
  CRITICAL: 0.95,
  URGENT: 0.8,
  HIGH: 0.6,
  NORMAL: 0.4,
  LOW: 0.2,
  LOWEST: 0.1,
} as const;

/**
 * Contexto de solo lectura que reciben los detectores.
 * Los detectores NO modifican estado, solo observan y generan tareas.
 */
export interface DetectorContext {
  readonly agentId: string;
  readonly position: { x: number; y: number };
  readonly now: number;

  readonly needs?: Readonly<{
    hunger?: number;
    thirst?: number;
    energy?: number;
    social?: number;
    fun?: number;
    mentalHealth?: number;
    hygiene?: number;
  }>;

  readonly health?: number;
  readonly maxHealth?: number;

  readonly inventory?: Readonly<Record<string, number>>;
  readonly inventoryLoad?: number;
  readonly inventoryCapacity?: number;

  readonly isInCombat?: boolean;
  readonly attackerId?: string;
  readonly threatLevel?: number;
  readonly nearbyEnemies?: readonly {
    id: string;
    x: number;
    y: number;
    type: string;
  }[];
  readonly nearbyPredators?: readonly {
    id: string;
    x: number;
    y: number;
    type: string;
  }[];

  readonly hasWeapon?: boolean;
  readonly equippedWeapon?: string;

  readonly roleType?: string;
  readonly isWorkHours?: boolean;

  readonly nearbyAgents?: readonly { id: string; x: number; y: number }[];
  readonly nearbyAgentInNeed?: {
    id: string;
    targetZoneId?: string;
    need?: string;
  };
  readonly potentialMate?: { id: string; x: number; y: number };

  readonly canCraftClub?: boolean;
  readonly canCraftDagger?: boolean;
  readonly craftZoneId?: string;

  readonly pendingBuilds?: readonly {
    id: string;
    zoneId: string;
    progress: number;
  }[];
  readonly contributableBuilding?: { zoneId: string };

  readonly nearestFood?: { id: string; x: number; y: number };
  readonly nearestWater?: { id: string; x: number; y: number };
  readonly nearestResource?: {
    id: string;
    x: number;
    y: number;
    type: string;
  };

  readonly depositZoneId?: string;
  readonly nearestMarketZoneId?: string;

  readonly hasExcessResources?: boolean;

  readonly lastExploreTime?: number;
  readonly visitedZones?: ReadonlySet<string>;
  /** Todas las zonas disponibles en el mundo para explorar */
  readonly allZones?: readonly { id: string; x: number; y: number }[];
  /** Recursos conocidos por el agente (de exploraciones previas) */
  readonly knownResources?: ReadonlyMap<string, { x: number; y: number }>;
  readonly nearbyInspectable?: {
    id: string;
    position: { x: number; y: number };
  };

  readonly personality?: Readonly<{
    diligence?: number;
    curiosity?: number;
    aggression?: number;
    sociability?: number;
  }>;
}

/**
 * Callbacks para que los handlers actualicen la memoria del agente.
 */
export interface MemoryCallbacks {
  /** Registra que el agente visitó una zona */
  recordVisitedZone: (zoneId: string) => void;
  /** Registra una ubicación de recurso conocida */
  recordKnownResource: (
    resourceType: string,
    position: { x: number; y: number },
  ) => void;
  /** Registra que el agente completó una exploración (actualiza cooldown) */
  recordExploration: () => void;
  /** Obtiene las zonas visitadas */
  getVisitedZones: () => ReadonlySet<string>;
  /** Obtiene las ubicaciones de recursos conocidas */
  getKnownResourceLocations: () => ReadonlyMap<
    string,
    { x: number; y: number }
  >;
}

/**
 * Contexto que reciben los handlers.
 *
 * Los handlers NO implementan lógica de negocio.
 * Solo validan precondiciones y delegan al sistema correspondiente.
 *
 * Flujo:
 * 1. Handler recibe HandlerContext con la tarea
 * 2. Handler valida precondiciones básicas
 * 3. Handler llama a systems.movement.requestMove() o similar
 * 4. Sistema procesa y retorna HandlerResult
 * 5. Handler convierte a HandlerExecutionResult
 */
export interface HandlerContext {
  readonly agentId: string;
  readonly task: Task;

  readonly position: { x: number; y: number };

  /** Registro de sistemas para delegación */
  readonly systems: SystemRegistry;

  /** Bus de eventos para comunicación cross-system */
  readonly events: EventBus;

  /** Callbacks para actualizar la memoria del agente */
  readonly memory?: MemoryCallbacks;
}

/**
 * Resultado de un handler
 */
export interface HandlerExecutionResult {
  /** Si la ejecución fue exitosa */
  success: boolean;
  /** Si la tarea está completada (true) o continúa en progreso (false) */
  completed: boolean;
  /** Mensaje de debug/error */
  message?: string;
  /** Sistema que manejó la solicitud */
  system?: string;
  /** Datos adicionales del resultado */
  data?: Record<string, unknown>;
}

/**
 * @deprecated Use HandlerExecutionResult instead
 */
export type ActionResult = HandlerExecutionResult;

let taskIdCounter = 0;

/**
 * Crea una nueva tarea con ID único
 */
export function createTask(params: CreateTaskParams): Task {
  const now = Date.now();
  return {
    id: `task_${++taskIdCounter}_${now}`,
    agentId: params.agentId,
    type: params.type,
    priority: params.priority,
    status: TaskStatus.PENDING,
    target: params.target,
    params: params.params,
    source: params.source,
    createdAt: now,
    expiresAt: params.ttlMs ? now + params.ttlMs : undefined,
  };
}

/**
 * Verifica si una tarea ha expirado
 */
export function isTaskExpired(task: Task, now: number = Date.now()): boolean {
  return task.expiresAt !== undefined && now >= task.expiresAt;
}

/**
 * Verifica si una tarea está en estado terminal
 */
export function isTaskTerminal(task: Task): boolean {
  return (
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.FAILED ||
    task.status === TaskStatus.CANCELLED
  );
}

/**
 * Convierte HandlerResult del sistema a HandlerExecutionResult
 */
export function toExecutionResult(
  result: HandlerResult,
): HandlerExecutionResult {
  return {
    success:
      result.status === HandlerResultStatus.COMPLETED ||
      result.status === HandlerResultStatus.DELEGATED,
    completed:
      result.status === HandlerResultStatus.COMPLETED ||
      result.status === HandlerResultStatus.FAILED,
    message: result.message,
    system: result.system,
    data: result.data as Record<string, unknown>,
  };
}

/**
 * Crea un resultado de error para handlers
 */
export function errorResult(message: string): HandlerExecutionResult {
  return {
    success: false,
    completed: true,
    message,
  };
}

/**
 * Crea un resultado de éxito para handlers
 */
export function successResult(
  data?: Record<string, unknown>,
): HandlerExecutionResult {
  return {
    success: true,
    completed: true,
    data,
  };
}

/**
 * Crea un resultado de "en progreso" para handlers
 */
export function inProgressResult(
  system: string,
  message?: string,
): HandlerExecutionResult {
  return {
    success: true,
    completed: false,
    system,
    message,
  };
}
