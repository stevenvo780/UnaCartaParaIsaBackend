/**
 * @fileoverview Unified Task Types for AI System
 *
 * Replaces the fragmented Goal/Task/Action system with a unified model.
 * A Task represents anything an agent needs to do, from satisfying hunger
 * to building structures.
 *
 * @module shared/types/simulation/unifiedTasks
 */

import type { NeedType } from "../../constants/AIEnums";
import type { ResourceType } from "../../constants/ResourceEnums";

/**
 * Unified Task Types
 */
export enum TaskType {
  SATISFY_NEED = "satisfy_need",
  REST = "rest",

  GATHER = "gather",
  CRAFT = "craft",
  BUILD = "build",
  DEPOSIT = "deposit",
  HUNT = "hunt",
  TRADE = "trade",

  SOCIALIZE = "socialize",
  ASSIST = "assist",

  ATTACK = "attack",
  FLEE = "flee",

  EXPLORE = "explore",

  IDLE = "idle",
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Position in world coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Target for a task - flexible to support different task types
 */
export interface TaskTarget {
  /** Entity ID (agent, animal, resource) */
  entityId?: string;
  /** World position */
  position?: Position;
  /** Zone ID */
  zoneId?: string;
}

/**
 * Task-specific parameters
 */
export interface TaskParams {
  /** For SATISFY_NEED */
  needType?: NeedType;
  /** For GATHER, DEPOSIT */
  resourceType?: ResourceType | string;
  /** For CRAFT */
  itemId?: string;
  /** Amount to gather/deposit */
  amount?: number;
  /** For BUILD */
  buildingId?: string;
  /** For collective tasks */
  communityTaskId?: string;
  /** Reason for the task (debugging) */
  reason?: string;
  /** Extra data */
  [key: string]: unknown;
}

/**
 * Unified Agent Task
 *
 * Represents anything an agent needs to do. Tasks are queued by priority
 * and resolved into primitive actions by TaskResolver.
 */
export interface AgentTask {
  /** Unique task ID */
  id: string;

  /** Agent who owns this task */
  agentId: string;

  /** Task type determines how it's resolved */
  type: TaskType;

  /** Priority (0-1, higher = more urgent) */
  priority: number;

  /** Target of the task */
  target?: TaskTarget;

  /** Task-specific parameters */
  params?: TaskParams;

  /** Current status */
  status: TaskStatus;

  /** When the task was created */
  createdAt: number;

  /** When the task expires (optional) */
  expiresAt?: number;

  /** Source of the task (detector, event, player, etc.) */
  source?: string;
}

/**
 * Primitive Action Types
 *
 * All complex behaviors (eating, crafting, socializing) are combinations
 * of these 5 primitive actions.
 */
export enum PrimitiveActionType {
  /** Move to a position, zone, or entity */
  MOVE = "move",

  /** Use something (eat food, drink water, craft item, harvest resource) */
  USE = "use",

  /** Attack an entity */
  ATTACK = "attack",

  /** Interact with another agent (socialize, trade) */
  INTERACT = "interact",

  /** Wait/idle for a duration */
  WAIT = "wait",
}

/**
 * Action target - similar to TaskTarget but for immediate actions
 */
export interface ActionTarget {
  entityId?: string;
  position?: Position;
  zoneId?: string;
}

/**
 * Action-specific parameters
 */
export interface ActionParams {
  /** Duration in ms (for WAIT, USE) */
  duration?: number;
  /** Resource type (for USE with resources) */
  resourceType?: string;
  /** Item ID (for USE with items) */
  itemId?: string;
  /** Interaction type (for INTERACT) */
  interactionType?: "socialize" | "trade" | "greet";
  /** Extra data */
  [key: string]: unknown;
}

/**
 * Primitive Action
 *
 * The simplest unit of agent behavior. TaskResolver converts Tasks into
 * sequences of PrimitiveActions.
 */
export interface PrimitiveAction {
  /** Action type */
  type: PrimitiveActionType;

  /** Target of the action */
  target?: ActionTarget;

  /** Action parameters */
  params?: ActionParams;

  /** When action was created */
  timestamp: number;
}

/**
 * Simplified AI State
 *
 * Replaces the complex AIState with a cleaner structure focused on task execution.
 */
export interface AgentAIState {
  /** Agent ID */
  entityId: string;

  /** Current task being executed */
  currentTask: AgentTask | null;

  /** Queue of pending tasks (ordered by priority) */
  taskQueue: AgentTask[];

  /** Current primitive action being executed */
  currentAction: PrimitiveAction | null;

  /** Last decision timestamp */
  lastDecisionTime: number;

  /** Is agent off-duty (player controlled, cutscene, etc.) */
  offDuty: boolean;

  /** Is agent in combat */
  isInCombat: boolean;

  /** Simple memory for task optimization */
  memory: {
    /** Zones the agent has visited */
    visitedZones: Set<string>;
    /** Recent failed task targets to avoid retrying */
    failedTargets: Map<string, number>;
    /** Home zone ID */
    homeZoneId?: string;
    /** Last exploration timestamp */
    lastExplorationTime?: number;
  };
}

/**
 * Task creation parameters (without generated fields)
 */
export type CreateTaskParams = Omit<AgentTask, "id" | "status" | "createdAt">;

/**
 * Task priority constants
 */
export const TASK_PRIORITIES = {
  CRITICAL: 0.95,
  URGENT: 0.8,
  HIGH: 0.6,
  NORMAL: 0.4,
  LOW: 0.2,
  LOWEST: 0.1,
  IDLE: 0.05,
} as const;

/**
 * Task timeout defaults (ms)
 */
export const TASK_TIMEOUTS: Record<TaskType, number> = {
  [TaskType.SATISFY_NEED]: 60000,
  [TaskType.REST]: 60000,
  [TaskType.GATHER]: 120000,
  [TaskType.CRAFT]: 60000,
  [TaskType.BUILD]: 180000,
  [TaskType.DEPOSIT]: 30000,
  [TaskType.HUNT]: 120000,
  [TaskType.TRADE]: 60000,
  [TaskType.SOCIALIZE]: 30000,
  [TaskType.ASSIST]: 60000,
  [TaskType.ATTACK]: 30000,
  [TaskType.FLEE]: 15000,
  [TaskType.EXPLORE]: 90000,
  [TaskType.IDLE]: 10000,
};

/**
 * Create a new task with defaults
 */
export function createTask(params: CreateTaskParams): AgentTask {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  return {
    id,
    status: TaskStatus.PENDING,
    createdAt: now,
    expiresAt: params.expiresAt ?? now + (TASK_TIMEOUTS[params.type] ?? 60000),
    ...params,
  };
}

/**
 * Check if a task has expired
 */
export function isTaskExpired(
  task: AgentTask,
  now: number = Date.now(),
): boolean {
  return task.expiresAt !== undefined && now >= task.expiresAt;
}

/**
 * Check if a task is in a terminal state
 */
export function isTaskTerminal(task: AgentTask): boolean {
  return (
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.FAILED ||
    task.status === TaskStatus.CANCELLED
  );
}
