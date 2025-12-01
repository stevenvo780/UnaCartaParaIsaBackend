/**
 * @fileoverview Detector de Necesidades
 *
 * Detecta cuando un agente tiene necesidades bajas y genera tareas.
 * Cubre: hambre, sed, energía, social, diversión, salud mental.
 *
 * @module domain/simulation/systems/agents/ai/detectors/NeedsDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";
import { NeedType } from "@/shared/constants/AIEnums";

const THRESHOLDS = {
  CRITICAL: 15,
  URGENT: 30,
  LOW: 50,
} as const;

/**
 * Detecta necesidades biológicas y genera tareas
 */
export function detectNeeds(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.needs) return tasks;

  const hunger = ctx.needs.hunger ?? 100;
  if (hunger < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SATISFY_NEED,
        priority: calculatePriority(hunger),
        target: ctx.nearestFood
          ? { entityId: ctx.nearestFood.id, position: ctx.nearestFood }
          : undefined,
        params: { needType: NeedType.HUNGER, resourceType: "food" },
        source: "detector:needs:hunger",
      }),
    );
  }

  const thirst = ctx.needs.thirst ?? 100;
  if (thirst < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SATISFY_NEED,
        priority: calculatePriority(thirst),
        target: ctx.nearestWater
          ? { entityId: ctx.nearestWater.id, position: ctx.nearestWater }
          : undefined,
        params: { needType: NeedType.THIRST, resourceType: "water" },
        source: "detector:needs:thirst",
      }),
    );
  }

  const energy = ctx.needs.energy ?? 100;
  if (energy < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.REST,
        priority: calculatePriority(energy),
        params: { needType: NeedType.ENERGY, duration: 5000 },
        source: "detector:needs:energy",
      }),
    );
  }

  const social = ctx.needs.social ?? 100;
  if (social < THRESHOLDS.LOW && ctx.nearbyAgents?.length) {
    const target = ctx.nearbyAgents[0];
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SOCIALIZE,
        priority: calculateSocialPriority(social),
        target: { entityId: target.id, position: target },
        params: { needType: NeedType.SOCIAL },
        source: "detector:needs:social",
      }),
    );
  }

  const fun = ctx.needs.fun ?? 100;
  if (fun < THRESHOLDS.LOW && ctx.nearbyAgents?.length) {
    const target = ctx.nearbyAgents[0];
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SOCIALIZE,
        priority: calculateSocialPriority(fun) * 0.9,
        target: { entityId: target.id, position: target },
        params: { needType: NeedType.FUN, action: "play" },
        source: "detector:needs:fun",
      }),
    );
  }

  const mentalHealth = ctx.needs.mentalHealth ?? 100;
  if (mentalHealth < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.REST,
        priority: calculateSocialPriority(mentalHealth),
        params: { needType: NeedType.MENTAL_HEALTH, action: "meditate" },
        source: "detector:needs:mental",
      }),
    );
  }

  return tasks;
}

/**
 * Calcula prioridad basada en nivel de necesidad
 */
function calculatePriority(value: number): number {
  if (value < THRESHOLDS.CRITICAL) return TASK_PRIORITIES.CRITICAL;
  if (value < THRESHOLDS.URGENT) return TASK_PRIORITIES.URGENT;
  return TASK_PRIORITIES.HIGH;
}

/**
 * Calcula prioridad para necesidades sociales (menos urgentes)
 */
function calculateSocialPriority(value: number): number {
  if (value < THRESHOLDS.CRITICAL) return TASK_PRIORITIES.HIGH;
  if (value < THRESHOLDS.URGENT) return TASK_PRIORITIES.NORMAL;
  return TASK_PRIORITIES.LOW;
}
