/**
 * @fileoverview Task Queue - ECS-Integrated Task Management
 *
 * Cola de tareas centralizada que integra con el EventBus y AgentStore.
 * Los sistemas emiten tareas, la cola las prioriza, los handlers las procesan.
 *
 * Flujo:
 * 1. Sistema detecta necesidad → emite tarea a la cola
 * 2. Cola prioriza y asigna tarea al agente
 * 3. Handler procesa la tarea → delega a sistema correspondiente
 * 4. Sistema actualiza componentes → emite evento de completado/fallido
 *
 * @module domain/simulation/ecs
 */

import { injectable, inject } from "inversify";
import { logger } from "@/infrastructure/utils/logger";
import type { AgentTask } from "@/shared/types/simulation/unifiedTasks";
import { EventBus } from "./EventBus";
import { AgentStore } from "./AgentStore";

// ============================================================================
// TYPES
// ============================================================================

export interface TaskQueueConfig {
  /** Max tasks per agent */
  maxTasksPerAgent: number;
  /** Enable debug logging */
  debug: boolean;
  /** Task timeout in ms (0 = no timeout) */
  taskTimeout: number;
}

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxTasksPerAgent: 5,
  debug: false,
  taskTimeout: 60000, // 1 minute default
};

export interface QueuedTask {
  task: AgentTask;
  queuedAt: number;
  startedAt?: number;
  priority: number;
}

// ============================================================================
// TASK QUEUE
// ============================================================================

@injectable()
export class TaskQueue {
  private config: TaskQueueConfig;
  private eventBus: EventBus;
  private agentStore: AgentStore;

  // Cola de tareas pendientes por agente
  private pendingTasks = new Map<string, QueuedTask[]>();

  // Tareas activas (una por agente)
  private activeTasks = new Map<string, QueuedTask>();

  constructor(
    @inject(EventBus) eventBus: EventBus,
    @inject(AgentStore) agentStore: AgentStore,
    config?: Partial<TaskQueueConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;
    this.agentStore = agentStore;

    logger.info("📋 TaskQueue: Initialized");
  }

  // ==========================================================================
  // TASK SUBMISSION
  // ==========================================================================

  /**
   * Encola una nueva tarea para un agente
   */
  public enqueue(
    agentId: string,
    task: AgentTask,
    priority: number = 50,
  ): void {
    if (!this.agentStore.hasAgent(agentId)) {
      logger.warn(
        `TaskQueue: Cannot enqueue task - agent ${agentId} not found`,
      );
      return;
    }

    // Inicializar cola si no existe
    if (!this.pendingTasks.has(agentId)) {
      this.pendingTasks.set(agentId, []);
    }

    const queue = this.pendingTasks.get(agentId)!;

    // Verificar límite
    if (queue.length >= this.config.maxTasksPerAgent) {
      // Reemplazar tarea de menor prioridad si la nueva es más importante
      const lowestPriorityIndex = queue.reduce(
        (minIdx, t, idx, arr) =>
          t.priority < arr[minIdx].priority ? idx : minIdx,
        0,
      );

      if (priority > queue[lowestPriorityIndex].priority) {
        const removed = queue.splice(lowestPriorityIndex, 1)[0];
        if (this.config.debug) {
          logger.debug(
            `TaskQueue: Replaced lower priority task ${removed.task.type} with ${task.type}`,
          );
        }
      } else {
        logger.debug(
          `TaskQueue: Queue full for agent ${agentId}, task ${task.type} rejected`,
        );
        return;
      }
    }

    const queuedTask: QueuedTask = {
      task,
      queuedAt: Date.now(),
      priority,
    };

    // Insertar ordenado por prioridad (mayor primero)
    const insertIndex = queue.findIndex((t) => t.priority < priority);
    if (insertIndex === -1) {
      queue.push(queuedTask);
    } else {
      queue.splice(insertIndex, 0, queuedTask);
    }

    // Emitir evento
    this.eventBus.emit("ai:task_started", {
      agentId,
      taskType: task.type,
      taskId: task.id || `task-${Date.now()}`,
      priority,
      timestamp: Date.now(),
    });

    if (this.config.debug) {
      logger.debug(
        `TaskQueue: Enqueued ${task.type} for agent ${agentId} (priority: ${priority})`,
      );
    }
  }

  /**
   * Encola una tarea urgente (se procesa inmediatamente)
   */
  public enqueueUrgent(agentId: string, task: AgentTask): void {
    // Cancelar tarea activa si existe
    this.cancelActive(agentId);

    // Encolar con máxima prioridad
    this.enqueue(agentId, task, 100);
  }

  // ==========================================================================
  // TASK PROCESSING
  // ==========================================================================

  /**
   * Obtiene la siguiente tarea a procesar para un agente
   */
  public getNextTask(agentId: string): AgentTask | undefined {
    // Si ya hay tarea activa, verificar timeout
    const active = this.activeTasks.get(agentId);
    if (active) {
      if (this.isTaskTimedOut(active)) {
        this.failTask(agentId, "timeout");
      } else {
        return active.task;
      }
    }

    // Obtener siguiente de la cola
    const queue = this.pendingTasks.get(agentId);
    if (!queue || queue.length === 0) {
      return undefined;
    }

    const next = queue.shift()!;
    next.startedAt = Date.now();
    this.activeTasks.set(agentId, next);

    return next.task;
  }

  /**
   * Marca la tarea activa como completada
   */
  public completeTask(agentId: string): void {
    const active = this.activeTasks.get(agentId);
    if (!active) return;

    const duration = Date.now() - (active.startedAt || active.queuedAt);

    // Emitir evento de completado
    this.eventBus.emit("ai:task_completed", {
      agentId,
      taskType: active.task.type,
      taskId: active.task.id || "unknown",
      duration,
      timestamp: Date.now(),
    });

    // Actualizar componente AI del agente
    const ai = this.agentStore.getAI(agentId);
    if (ai) {
      this.agentStore.setComponent(agentId, "ai", {
        ...ai,
        currentTask: undefined,
        taskStartTime: undefined,
        lastDecisionTime: Date.now(),
        isProcessing: false,
      });
    }

    this.activeTasks.delete(agentId);

    if (this.config.debug) {
      logger.debug(
        `TaskQueue: Completed ${active.task.type} for agent ${agentId} (${duration}ms)`,
      );
    }
  }

  /**
   * Marca la tarea activa como fallida
   */
  public failTask(agentId: string, reason: string): void {
    const active = this.activeTasks.get(agentId);
    if (!active) return;

    // Emitir evento de fallo
    this.eventBus.emit("ai:task_failed", {
      agentId,
      taskType: active.task.type,
      taskId: active.task.id || "unknown",
      reason,
      timestamp: Date.now(),
    });

    // Actualizar componente AI
    const ai = this.agentStore.getAI(agentId);
    if (ai) {
      this.agentStore.setComponent(agentId, "ai", {
        ...ai,
        currentTask: undefined,
        taskStartTime: undefined,
        isProcessing: false,
      });
    }

    this.activeTasks.delete(agentId);

    if (this.config.debug) {
      logger.debug(
        `TaskQueue: Failed ${active.task.type} for agent ${agentId}: ${reason}`,
      );
    }
  }

  /**
   * Cancela la tarea activa sin emitir fallo
   */
  public cancelActive(agentId: string): void {
    this.activeTasks.delete(agentId);
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Obtiene la tarea activa de un agente
   */
  public getActiveTask(agentId: string): AgentTask | undefined {
    return this.activeTasks.get(agentId)?.task;
  }

  /**
   * Verifica si un agente tiene tareas pendientes o activas
   */
  public hasTasks(agentId: string): boolean {
    const hasActive = this.activeTasks.has(agentId);
    const hasPending = (this.pendingTasks.get(agentId)?.length || 0) > 0;
    return hasActive || hasPending;
  }

  /**
   * Cuenta de tareas pendientes
   */
  public getPendingCount(agentId: string): number {
    return this.pendingTasks.get(agentId)?.length || 0;
  }

  /**
   * Obtiene todas las tareas pendientes de un agente
   */
  public getPendingTasks(agentId: string): AgentTask[] {
    return this.pendingTasks.get(agentId)?.map((q) => q.task) || [];
  }

  /**
   * Verifica si un agente tiene una tarea de tipo específico activa o pendiente
   */
  public hasTaskOfType(agentId: string, taskType: string): boolean {
    // Verificar activa
    const active = this.activeTasks.get(agentId);
    if (active?.task.type === taskType) return true;

    // Verificar pendientes
    const pending = this.pendingTasks.get(agentId) || [];
    return pending.some((q) => q.task.type === taskType);
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Limpia todas las tareas de un agente
   */
  public clearAgent(agentId: string): void {
    this.activeTasks.delete(agentId);
    this.pendingTasks.delete(agentId);
  }

  /**
   * Limpia todas las tareas
   */
  public clearAll(): void {
    this.activeTasks.clear();
    this.pendingTasks.clear();
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private isTaskTimedOut(queuedTask: QueuedTask): boolean {
    if (this.config.taskTimeout === 0) return false;
    const startTime = queuedTask.startedAt || queuedTask.queuedAt;
    return Date.now() - startTime > this.config.taskTimeout;
  }
}
