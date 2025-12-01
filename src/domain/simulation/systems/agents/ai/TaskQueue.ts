/**
 * @fileoverview Task Queue for Agent AI
 *
 * Manages a priority queue of tasks for each agent. Tasks are sorted by priority
 * and filtered for expiration/validity before being processed.
 *
 * @module domain/simulation/systems/agents/ai/TaskQueue
 */

import { logger } from "@/infrastructure/utils/logger";
import {
  type AgentTask,
  TaskStatus,
  isTaskExpired,
  isTaskTerminal,
} from "@/shared/types/simulation/unifiedTasks";

/**
 * Task Queue Configuration
 */
export interface TaskQueueConfig {
  /** Maximum tasks per agent */
  maxTasksPerAgent: number;
  /** Auto-remove expired tasks */
  autoCleanExpired: boolean;
  /** Log debug messages */
  debug: boolean;
}

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxTasksPerAgent: 10,
  autoCleanExpired: true,
  debug: false,
};

/**
 * Task Queue
 *
 * Manages pending tasks for all agents. Each agent has their own queue,
 * sorted by priority (highest first).
 *
 * Features:
 * - Priority-based ordering
 * - Automatic expiration handling
 * - Max queue size enforcement
 * - Duplicate task prevention
 *
 * @example
 * ```ts
 * const queue = new TaskQueue();
 *
 *
 * queue.enqueue(agentId, {
 *   type: TaskType.GATHER,
 *   priority: 0.6,
 *   params: { resourceType: 'wood' }
 * });
 *
 *
 * const task = queue.dequeue(agentId);
 *
 *
 * const nextTask = queue.peek(agentId);
 * ```
 */
export class TaskQueue {
  private queues = new Map<string, AgentTask[]>();
  private config: TaskQueueConfig;

  constructor(config: Partial<TaskQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a task to an agent's queue.
   *
   * KEY BEHAVIOR: Duplicate tasks (same type + target) BOOST priority instead of being rejected.
   * This allows events to "stack" - e.g., being attacked 10 times = very high priority to fight back.
   *
   * @param agentId - Agent to queue task for
   * @param task - Task to queue
   * @param priorityBoost - Amount to boost priority if duplicate (default: 0.1)
   */
  public enqueue(
    agentId: string,
    task: AgentTask,
    priorityBoost: number = 0.1,
  ): boolean {
    let queue = this.queues.get(agentId);

    if (!queue) {
      queue = [];
      this.queues.set(agentId, queue);
    }

    const existingIndex = this.findSimilarTaskIndex(queue, task);
    if (existingIndex !== -1) {
      const existing = queue[existingIndex];
      const newPriority = Math.min(1, existing.priority + priorityBoost);

      if (this.config.debug) {
        logger.debug(
          `TaskQueue: Boosting ${task.type} priority ${existing.priority.toFixed(2)} → ${newPriority.toFixed(2)} for agent ${agentId}`,
        );
      }

      existing.priority = newPriority;
      queue.splice(existingIndex, 1);
      const newIndex = this.findInsertIndex(queue, newPriority);
      queue.splice(newIndex, 0, existing);

      return true;
    }

    if (queue.length >= this.config.maxTasksPerAgent) {
      queue.pop();
    }

    const insertIndex = this.findInsertIndex(queue, task.priority);
    queue.splice(insertIndex, 0, task);

    if (this.config.debug) {
      logger.debug(
        `TaskQueue: Enqueued ${task.type} (priority: ${task.priority}) for agent ${agentId}`,
      );
    }

    return true;
  }

  /**
   * Remove and return the highest priority task for an agent.
   * Skips expired/invalid tasks.
   */
  public dequeue(agentId: string): AgentTask | null {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return null;

    if (this.config.autoCleanExpired) {
      this.cleanExpired(agentId);
    }

    while (queue.length > 0) {
      const task = queue.shift();
      if (task && !isTaskTerminal(task) && !isTaskExpired(task)) {
        task.status = TaskStatus.ACTIVE;
        return task;
      }
    }

    return null;
  }

  /**
   * Peek at the highest priority task without removing it.
   */
  public peek(agentId: string): AgentTask | null {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return null;

    for (const task of queue) {
      if (!isTaskTerminal(task) && !isTaskExpired(task)) {
        return task;
      }
    }

    return null;
  }

  /**
   * Get all pending tasks for an agent (read-only).
   */
  public getTasks(agentId: string): readonly AgentTask[] {
    return this.queues.get(agentId) ?? [];
  }

  /**
   * Get count of pending tasks for an agent.
   */
  public getTaskCount(agentId: string): number {
    return this.queues.get(agentId)?.length ?? 0;
  }

  /**
   * Check if agent has any pending tasks.
   */
  public hasTasks(agentId: string): boolean {
    return this.getTaskCount(agentId) > 0;
  }

  /**
   * Clear all tasks for an agent.
   */
  public clear(agentId: string): void {
    this.queues.delete(agentId);
  }

  /**
   * Clear all queues.
   */
  public clearAll(): void {
    this.queues.clear();
  }

  /**
   * Remove a specific task by ID.
   */
  public removeTask(agentId: string, taskId: string): boolean {
    const queue = this.queues.get(agentId);
    if (!queue) return false;

    const index = queue.findIndex((t) => t.id === taskId);
    if (index === -1) return false;

    queue.splice(index, 1);
    return true;
  }

  /**
   * Mark a task as completed.
   */
  public completeTask(agentId: string, taskId: string): boolean {
    const queue = this.queues.get(agentId);
    if (!queue) return false;

    const task = queue.find((t) => t.id === taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      return true;
    }
    return false;
  }

  /**
   * Mark a task as failed.
   */
  public failTask(agentId: string, taskId: string): boolean {
    const queue = this.queues.get(agentId);
    if (!queue) return false;

    const task = queue.find((t) => t.id === taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      return true;
    }
    return false;
  }

  /**
   * Remove expired tasks from an agent's queue.
   */
  public cleanExpired(agentId: string): number {
    const queue = this.queues.get(agentId);
    if (!queue) return 0;

    const now = Date.now();
    const before = queue.length;

    const filtered = queue.filter(
      (task) => !isTaskExpired(task, now) && !isTaskTerminal(task),
    );

    if (filtered.length !== before) {
      this.queues.set(agentId, filtered);
    }

    return before - filtered.length;
  }

  /**
   * Clean all expired tasks across all agents.
   */
  public cleanAllExpired(): number {
    let total = 0;
    for (const agentId of this.queues.keys()) {
      total += this.cleanExpired(agentId);
    }
    return total;
  }

  /**
   * Get queue stats for monitoring.
   */
  public getStats(): {
    totalAgents: number;
    totalTasks: number;
    avgTasksPerAgent: number;
  } {
    let totalTasks = 0;
    for (const queue of this.queues.values()) {
      totalTasks += queue.length;
    }

    const totalAgents = this.queues.size;
    return {
      totalAgents,
      totalTasks,
      avgTasksPerAgent: totalAgents > 0 ? totalTasks / totalAgents : 0,
    };
  }

  /**
   * Find the correct index to insert a task based on priority.
   * Higher priority tasks come first.
   */
  private findInsertIndex(queue: AgentTask[], priority: number): number {
    for (let i = 0; i < queue.length; i++) {
      if (priority > queue[i].priority) {
        return i;
      }
    }
    return queue.length;
  }

  /**
   * Check if a similar task already exists in the queue.
   * Similar = same type and same target.
   * Returns the index of the similar task, or -1 if not found.
   */
  private findSimilarTaskIndex(queue: AgentTask[], newTask: AgentTask): number {
    return queue.findIndex((existing) => {
      if (existing.type !== newTask.type) return false;
      if (isTaskTerminal(existing)) return false;

      const existingTarget = existing.target;
      const newTarget = newTask.target;

      if (!existingTarget && !newTarget) return true;
      if (!existingTarget || !newTarget) return false;

      return (
        existingTarget.entityId === newTarget.entityId &&
        existingTarget.zoneId === newTarget.zoneId
      );
    });
  }
}
