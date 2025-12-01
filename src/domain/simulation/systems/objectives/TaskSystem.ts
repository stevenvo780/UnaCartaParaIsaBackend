import { GameState, type TaskState } from "@/shared/types/game-types";
import { Task, TaskCreationParams } from "@/shared/types/simulation/tasks";
import { simulationEvents, GameEventType } from "../../core/events";
import { getFrameTime } from "../../../../shared/FrameTime";

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import type { StateDirtyTracker } from "../../core/StateDirtyTracker";
import { performanceMonitor } from "../../core/PerformanceMonitor";

/**
 * System for managing tasks and work assignments.
 *
 * Features:
 * - Task creation with resource requirements
 * - Progress tracking with contributor system
 * - Stalled task detection and cancellation
 * - Social synergy multipliers for collaborative work
 * - Task statistics and state management
 *
 * @see BuildingSystem for construction tasks
 * @see AISystem for task assignment
 */
@injectable()
export class TaskSystem {
  private gameState: GameState;
  private tasks = new Map<string, Task>();
  private seq = 0;
  private lastUpdate = 0;
  private tasksDirty = true;
  private statsDirty = true;
  private cachedStats: TaskState["stats"] = {
    total: 0,
    active: 0,
    completed: 0,
    stalled: 0,
    avgProgress: 0,
  };

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.StateDirtyTracker)
    @optional()
    private dirtyTracker?: StateDirtyTracker,
  ) {
    this.gameState = gameState;
    this.tasks = new Map();
    this.lastUpdate = 0;
  }

  public update(): void {
    const now = getFrameTime();
    const dtSec = (now - this.lastUpdate) / 1000;
    if (dtSec < 2) return;
    this.lastUpdate = now;

    const STALLED_THRESHOLD = 300000;
    const MAX_STALLED_AGE = 600000;

    for (const task of this.tasks.values()) {
      if (task.completed) continue;

      if (task.lastContribution) {
        const timeSinceLastContribution = now - task.lastContribution;

        if (timeSinceLastContribution > MAX_STALLED_AGE) {
          this.cancelStalledTask(task.id, "timeout");
        } else if (timeSinceLastContribution > STALLED_THRESHOLD) {
          simulationEvents.emit(GameEventType.TASK_STALLED, {
            taskId: task.id,
            taskType: task.type,
            zoneId: task.zoneId,
            stalledDuration: timeSinceLastContribution,
            timestamp: now,
          });
        }
      }
    }

    if (!this.gameState.tasks) {
      this.gameState.tasks = {
        tasks: [],
        stats: {
          total: 0,
          active: 0,
          completed: 0,
          stalled: 0,
          avgProgress: 0,
        },
      };
    }

    const stats = this.getTaskStats();
    if (this.hasStatsChanged(stats)) {
      this.cachedStats = stats;
      this.statsDirty = true;
    }

    const duration = performance.now() - now;
    performanceMonitor.recordSubsystemExecution(
      "TaskSystem",
      "update",
      duration,
    );
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public createTask(params: TaskCreationParams): Task | null {
    if (params.requirements?.resources && this.gameState.resources) {
      const res = this.gameState.resources;
      const req = params.requirements.resources;
      const missing: Record<string, number> = {};

      if (req.wood && (res.materials.wood || 0) < req.wood) {
        missing.wood = req.wood - (res.materials.wood || 0);
      }
      if (req.stone && (res.materials.stone || 0) < req.stone) {
        missing.stone = req.stone - (res.materials.stone || 0);
      }
      if (req.food && (res.materials.food || 0) < req.food) {
        missing.food = req.food - (res.materials.food || 0);
      }
      if (req.water && (res.materials.water || 0) < req.water) {
        missing.water = req.water - (res.materials.water || 0);
      }

      if (Object.keys(missing).length > 0) {
        return null;
      }
    }

    const task: Task = {
      id: `task_${++this.seq}`,
      createdAt: Date.now(),
      progress: 0,
      completed: false,
      ...params,
    };

    this.tasks.set(task.id, task);

    simulationEvents.emit(GameEventType.TASK_CREATED, {
      taskId: task.id,
      taskType: task.type,
      zoneId: task.zoneId,
      requiredWork: task.requiredWork,
      timestamp: Date.now(),
    });

    this.tasksDirty = true;
    this.statsDirty = true;

    return task;
  }

  public contributeToTask(
    taskId: string,
    agentId: string,
    contribution: number,
    socialSynergyMultiplier = 1.0,
  ): {
    progressMade: boolean;
    completed: boolean;
    blocked: boolean;
  } {
    const task = this.tasks.get(taskId);
    if (!task || task.completed) {
      return { progressMade: false, completed: false, blocked: false };
    }

    if (!task.contributors) {
      task.contributors = new Map<string, number>();
    }

    const minWorkers = task.requirements?.minWorkers ?? 1;
    const activeWorkers = task.contributors.size + 1;

    if (activeWorkers < minWorkers) {
      if (!task.contributors.has(agentId)) {
        task.contributors.set(agentId, 0);
      }
      return { progressMade: false, completed: false, blocked: true };
    }

    let finalContribution = contribution * socialSynergyMultiplier;
    if (minWorkers > 1 && activeWorkers >= minWorkers) {
      const coopBonus = 1 + Math.min(0.4, 0.1 * (activeWorkers - 1));
      finalContribution *= coopBonus;
    }

    const previousContribution = task.contributors.get(agentId) || 0;
    task.contributors.set(agentId, previousContribution + finalContribution);

    task.progress = Math.min(
      task.requiredWork,
      task.progress + finalContribution,
    );
    task.lastContribution = Date.now();

    const completed = task.progress >= task.requiredWork;
    if (completed) {
      task.completed = true;
    }

    this.tasksDirty = true;
    this.dirtyTracker?.markDirty("tasks");

    simulationEvents.emit(GameEventType.TASK_PROGRESS, {
      taskId,
      agentId,
      progress: task.progress,
      requiredWork: task.requiredWork,
      completed,
      contributors: Array.from(task.contributors.keys()),
      timestamp: Date.now(),
    });

    if (completed) {
      this.recordWorkHistory(taskId, Array.from(task.contributors.keys()));

      simulationEvents.emit(GameEventType.TASK_COMPLETED, {
        taskId,
        completedBy: Array.from(task.contributors.keys()),
        completedAt: Date.now(),
        timestamp: Date.now(),
      });
    }

    return {
      progressMade: true,
      completed,
      blocked: false,
    };
  }

  private workHistory = new Map<
    string,
    {
      taskId: string;
      taskType: string;
      contribution: number;
      timestamp: number;
    }[]
  >();

  public getWorkHistory(agentId: string): {
    taskId: string;
    taskType: string;
    contribution: number;
    timestamp: number;
  }[] {
    return this.workHistory.get(agentId) || [];
  }

  private recordWorkHistory(taskId: string, contributors: string[]): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    for (const agentId of contributors) {
      const contribution = task.contributors?.get(agentId) || 0;
      const history = this.workHistory.get(agentId) || [];

      history.unshift({
        taskId: task.id,
        taskType: task.type,
        contribution,
        timestamp: Date.now(),
      });

      if (history.length > 10) {
        history.pop();
      }

      this.workHistory.set(agentId, history);
    }
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  public getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((t) => !t.completed);
  }

  public getCompletedTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.completed);
  }

  public getTasksInZone(zoneId: string): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.zoneId === zoneId);
  }

  public getTasksNearPosition(
    position: { x: number; y: number },
    radius: number,
  ): Task[] {
    const radiusSq = radius * radius;
    return Array.from(this.tasks.values()).filter((task) => {
      if (!task.bounds || task.completed) return false;

      const centerX = task.bounds.x + task.bounds.width / 2;
      const centerY = task.bounds.y + task.bounds.height / 2;

      const dx = position.x - centerX;
      const dy = position.y - centerY;
      const distanceSq = dx * dx + dy * dy;

      return distanceSq <= radiusSq;
    });
  }

  public removeTask(id: string): boolean {
    const removed = this.tasks.delete(id);
    if (removed) {
      this.tasksDirty = true;
      this.statsDirty = true;
    }
    return removed;
  }

  public getTaskContributors(taskId: string): Array<{
    agentId: string;
    contribution: number;
  }> {
    const task = this.tasks.get(taskId);
    if (!task || !task.contributors) return [];

    return Array.from(task.contributors.entries()).map(
      ([agentId, contribution]) => ({
        agentId,
        contribution,
      }),
    );
  }

  public getAgentTasks(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter((task) =>
      task.contributors?.has(agentId),
    );
  }

  /**
   * Removes a specific agent from a task's contributors.
   *
   * @param taskId - The ID of the task.
   * @param agentId - The ID of the agent to remove.
   */
  public removeContributor(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.contributors) {
      task.contributors.delete(agentId);
      this.tasksDirty = true;
    }
  }

  /**
   * Removes an agent from all tasks they are currently contributing to.
   * Useful when an agent dies or is removed from the simulation.
   *
   * @param agentId - The ID of the agent to remove.
   */
  public removeAgentFromAllTasks(agentId: string): void {
    for (const task of this.tasks.values()) {
      if (task.contributors?.has(agentId)) {
        task.contributors.delete(agentId);
      }
    }
  }

  public getStalledTasks(thresholdMs = 300000): Task[] {
    const now = Date.now();
    return Array.from(this.tasks.values()).filter((task) => {
      if (task.completed || !task.lastContribution) return false;
      return now - task.lastContribution > thresholdMs;
    });
  }

  /**
   * Claims a task for an agent, preventing other agents from duplicating work.
   * Returns true if claim was successful, false if task is full.
   *
   * @param taskId - ID of the task to claim
   * @param agentId - ID of the agent claiming the task
   * @returns true if claim was successful
   */
  public claimTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.completed) return false;

    const maxClaims = (task.metadata?.maxClaims as number | undefined) || 1;
    const currentClaims =
      (task.metadata?.claimCount as number | undefined) || 0;

    if (currentClaims >= maxClaims) {
      return false;
    }

    if (!task.metadata) task.metadata = {};
    task.metadata.claimCount = currentClaims + 1;

    if (!task.metadata.claimedBy) {
      task.metadata.claimedBy = [];
    }
    (task.metadata.claimedBy as string[]).push(agentId);

    this.tasksDirty = true;
    return true;
  }

  /**
   * Releases a task claim when agent finishes or abandons the task.
   *
   * @param taskId - ID of the task
   * @param agentId - ID of the agent releasing the claim
   */
  public releaseTaskClaim(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.metadata) return;

    const claimedBy = task.metadata.claimedBy as string[] | undefined;
    if (claimedBy) {
      const index = claimedBy.indexOf(agentId);
      if (index !== -1) {
        claimedBy.splice(index, 1);
        task.metadata.claimCount = Math.max(
          0,
          ((task.metadata.claimCount as number) || 1) - 1,
        );
        this.tasksDirty = true;
      }
    }
  }

  /**
   * Gets available community tasks that need workers.
   * Community tasks are those marked with communityTask: true in metadata.
   *
   * @returns Array of available community tasks
   */
  public getAvailableCommunityTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((task) => {
      if (task.completed || !(task.metadata?.communityTask as boolean)) {
        return false;
      }

      const maxClaims = (task.metadata?.maxClaims as number | undefined) || 1;
      const currentClaims =
        (task.metadata?.claimCount as number | undefined) || 0;

      return currentClaims < maxClaims;
    });
  }

  public getTaskStats(): {
    total: number;
    active: number;
    completed: number;
    stalled: number;
    avgProgress: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const active = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);
    const stalled = this.getStalledTasks();

    const avgProgress =
      active.length > 0
        ? active.reduce((sum, t) => sum + t.progress / t.requiredWork, 0) /
          active.length
        : 0;

    return {
      total: tasks.length,
      active: active.length,
      completed: completed.length,
      stalled: stalled.length,
      avgProgress,
    };
  }

  private cancelStalledTask(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.completed = true;
    task.cancelled = true;
    task.cancellationReason = reason;

    simulationEvents.emit(GameEventType.TASK_COMPLETED, {
      taskId,
      completedBy: task.contributors
        ? Array.from(task.contributors.keys())
        : [],
      completedAt: Date.now(),
      cancelled: true,
      reason,
      timestamp: Date.now(),
    });
  }

  public cleanup(): void {
    this.tasks.clear();
    this.seq = 0;
    this.tasksDirty = true;
    this.statsDirty = true;
  }

  public syncTasksState(): boolean {
    const state = this.ensureTaskState();
    let changed = false;

    if (this.tasksDirty) {
      state.tasks = this.serializeTasks();
      this.tasksDirty = false;
      changed = true;
    }

    if (this.statsDirty) {
      state.stats = { ...this.cachedStats };
      this.statsDirty = false;
      changed = true;
    }

    return changed;
  }

  private ensureTaskState(): TaskState {
    if (!this.gameState.tasks) {
      this.gameState.tasks = {
        tasks: [],
        stats: { ...this.cachedStats },
      };
    }
    return this.gameState.tasks;
  }

  private serializeTasks(): TaskState["tasks"] {
    return Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      type: task.type,
      progress: task.progress,
      requiredWork: task.requiredWork,
      completed: task.completed,
      cancelled: task.cancelled,
      cancellationReason: task.cancellationReason,
      zoneId: task.zoneId,
      bounds: task.bounds
        ? {
            x: task.bounds.x,
            y: task.bounds.y,
            width: task.bounds.width,
            height: task.bounds.height,
          }
        : undefined,
      requirements: task.requirements
        ? {
            resources: { ...task.requirements.resources },
            minWorkers: task.requirements.minWorkers,
          }
        : undefined,
      metadata: task.metadata ? { ...task.metadata } : undefined,
      contributors: task.contributors
        ? Array.from(task.contributors.entries()).map(
            ([agentId, contribution]) => ({
              agentId,
              contribution,
            }),
          )
        : undefined,
      lastContribution: task.lastContribution,
      createdAt: task.createdAt,
      targetAnimalId: task.targetAnimalId,
    }));
  }

  private hasStatsChanged(next: TaskState["stats"]): boolean {
    return (
      next.total !== this.cachedStats.total ||
      next.active !== this.cachedStats.active ||
      next.completed !== this.cachedStats.completed ||
      next.stalled !== this.cachedStats.stalled ||
      Math.abs(next.avgProgress - this.cachedStats.avgProgress) > 0.0001
    );
  }
}
