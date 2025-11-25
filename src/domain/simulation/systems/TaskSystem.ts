import { GameState } from "../../types/game-types";
import { Task, TaskCreationParams } from "../../types/simulation/tasks";
import { simulationEvents, GameEventNames } from "../core/events";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class TaskSystem {
  private gameState: GameState;
  private tasks = new Map<string, Task>();
  private seq = 0;
  private lastUpdate = 0;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.lastUpdate = Date.now();
  }

  public update(): void {
    const now = Date.now();
    const dtSec = (now - this.lastUpdate) / 1000;
    // Reducir intervalo de 10s a 2s para detección más rápida de tareas stalled
    if (dtSec < 2) return;
    this.lastUpdate = now;

    const STALLED_THRESHOLD = 300000; // 5 minutes
    const MAX_STALLED_AGE = 600000; // 10 minutes - cancelar después de esto

    this.tasks.forEach((task) => {
      if (task.completed) return;

      if (task.lastContribution) {
        const timeSinceLastContribution = now - task.lastContribution;

        if (timeSinceLastContribution > MAX_STALLED_AGE) {
          // Cancelar tarea muy vieja
          this.cancelStalledTask(task.id, "timeout");
        } else if (timeSinceLastContribution > STALLED_THRESHOLD) {
          // Emitir evento de tarea stalled para que otros sistemas reaccionen
          simulationEvents.emit(GameEventNames.TASK_STALLED, {
            taskId: task.id,
            taskType: task.type,
            zoneId: task.zoneId,
            stalledDuration: timeSinceLastContribution,
            timestamp: now,
          });
        }
      }
    });

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
    this.gameState.tasks.stats = stats;
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

    simulationEvents.emit(GameEventNames.TASK_CREATED, {
      taskId: task.id,
      taskType: task.type,
      zoneId: task.zoneId,
      requiredWork: task.requiredWork,
      timestamp: Date.now(),
    });

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

    simulationEvents.emit(GameEventNames.TASK_PROGRESS, {
      taskId,
      agentId,
      progress: task.progress,
      requiredWork: task.requiredWork,
      completed,
      contributors: Array.from(task.contributors.keys()),
      timestamp: Date.now(),
    });

    if (completed) {
      simulationEvents.emit(GameEventNames.TASK_COMPLETED, {
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
    return Array.from(this.tasks.values()).filter((task) => {
      if (!task.bounds || task.completed) return false;

      const centerX = task.bounds.x + task.bounds.width / 2;
      const centerY = task.bounds.y + task.bounds.height / 2;

      const dx = position.x - centerX;
      const dy = position.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance <= radius;
    });
  }

  public removeTask(id: string): boolean {
    return this.tasks.delete(id);
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

  public getStalledTasks(thresholdMs = 300000): Task[] {
    const now = Date.now();
    return Array.from(this.tasks.values()).filter((task) => {
      if (task.completed || !task.lastContribution) return false;
      return now - task.lastContribution > thresholdMs;
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

    simulationEvents.emit(GameEventNames.TASK_COMPLETED, {
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
  }
}
