/**
 * @fileoverview Detector de Construcción
 *
 * Detecta cuando hay edificios que construir o a los que contribuir.
 *
 * @module domain/simulation/systems/agents/ai/detectors/BuildDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta necesidad de construir
 */
export function detectBuild(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // 1. Construcciones pendientes (para builders)
  if (ctx.pendingBuilds?.length) {
    const role = (ctx.roleType ?? "").toLowerCase();

    if (role === "builder" || role === "worker") {
      const best = ctx.pendingBuilds[0]; // Ya ordenadas por prioridad

      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.BUILD,
          priority: calculateBuildPriority(ctx, best.progress),
          target: { zoneId: best.zoneId },
          params: {
            taskId: best.id,
            workType: "construction",
          },
          source: "detector:build:construct",
        }),
      );
    }
  }

  // 2. Contribuir recursos a edificio
  if (ctx.contributableBuilding) {
    const hasResources =
      (ctx.inventory?.wood ?? 0) > 5 || (ctx.inventory?.stone ?? 0) > 5;

    if (hasResources) {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.BUILD,
          priority: TASK_PRIORITIES.NORMAL,
          target: { zoneId: ctx.contributableBuilding.zoneId },
          params: {
            action: "contribute_resources",
            wood: ctx.inventory?.wood ?? 0,
            stone: ctx.inventory?.stone ?? 0,
          },
          source: "detector:build:contribute",
        }),
      );
    }
  }

  return tasks;
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateBuildPriority(
  ctx: DetectorContext,
  progress: number,
): number {
  let priority = TASK_PRIORITIES.NORMAL;

  // Más prioritario si está casi terminado
  if (progress > 0.7) {
    priority += 0.2;
  }

  // Bonus por personalidad
  const conscientiousness = ctx.personality?.diligence ?? 0.5;
  priority += conscientiousness * 0.1;

  return Math.min(0.9, priority);
}
