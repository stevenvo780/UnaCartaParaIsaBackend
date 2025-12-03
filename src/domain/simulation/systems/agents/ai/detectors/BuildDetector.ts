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
import { RoleType } from "../../../../../../shared/constants/RoleEnums";
import { ActionType } from "../../../../../../shared/constants/AIEnums";

import { GoalType } from "@/shared/constants/AIEnums";
/**
 * Detecta necesidad de construir
 */
export function detectBuild(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (ctx.pendingBuilds?.length) {
    const role = (ctx.roleType ?? "").toLowerCase();

    if (role === RoleType.BUILDER || role === "worker") {
      const best = ctx.pendingBuilds[0];

      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.BUILD,
          priority: calculateBuildPriority(ctx, best.progress),
          target: { zoneId: best.zoneId },
          params: {
            taskId: best.id,
            workType: GoalType.CONSTRUCTION,
          },
          source: "detector:build:construct",
        }),
      );
    }
  }

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
            action: ActionType.CONTRIBUTE_RESOURCES,
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

function calculateBuildPriority(
  ctx: DetectorContext,
  progress: number,
): number {
  let priority = TASK_PRIORITIES.NORMAL;

  if (progress > 0.7) {
    priority += 0.2;
  }

  const conscientiousness = ctx.personality?.diligence ?? 0.5;
  priority += conscientiousness * 0.1;

  return Math.min(0.9, priority);
}
