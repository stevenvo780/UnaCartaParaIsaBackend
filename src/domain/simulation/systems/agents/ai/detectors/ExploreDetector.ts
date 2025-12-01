/**
 * @fileoverview Detector de Exploración
 *
 * Detecta cuando un agente debería explorar.
 * Cubre: curiosidad, búsqueda de recursos, inspección.
 *
 * @module domain/simulation/systems/agents/ai/detectors/ExploreDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";

/** Tiempo mínimo entre exploraciones (ms) */
const EXPLORE_COOLDOWN = 60000;
/** Tiempo largo sin explorar aumenta urgencia */
const EXPLORE_URGENCY_TIME = 300000;

/**
 * Detecta necesidad de explorar
 */
export function detectExplore(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  const inspectTask = detectInspect(ctx);
  if (inspectTask) {
    tasks.push(inspectTask);
  }

  const exploreTask = detectCuriosityExplore(ctx);
  if (exploreTask) {
    tasks.push(exploreTask);
  }

  const resourceScoutTask = detectResourceScout(ctx);
  if (resourceScoutTask) {
    tasks.push(resourceScoutTask);
  }

  return tasks;
}

function detectInspect(ctx: DetectorContext): Task | null {
  if (!ctx.nearbyInspectable) return null;

  const curiosity = ctx.personality?.curiosity ?? 0.5;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: TASK_PRIORITIES.LOW + curiosity * 0.2,
    target: {
      entityId: ctx.nearbyInspectable.id,
      position: ctx.nearbyInspectable.position,
    },
    params: { explorationType: "inspect" },
    source: "detector:explore:inspect",
  });
}

function detectCuriosityExplore(ctx: DetectorContext): Task | null {
  const lastExplore = ctx.lastExploreTime ?? 0;
  const timeSinceExplore = ctx.now - lastExplore;

  if (timeSinceExplore < EXPLORE_COOLDOWN) return null;

  const curiosity = ctx.personality?.curiosity ?? 0.5;

  let priority = TASK_PRIORITIES.LOWEST + curiosity * 0.1;

  if (timeSinceExplore > EXPLORE_URGENCY_TIME) {
    priority += 0.15;
  }

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: Math.min(TASK_PRIORITIES.NORMAL, priority),
    params: {
      explorationType: "curiosity",
      reason: "cognitive_drive",
    },
    source: "detector:explore:curiosity",
  });
}

function detectResourceScout(ctx: DetectorContext): Task | null {
  if (!ctx.inventoryCapacity) return null;

  const loadRatio = (ctx.inventoryLoad ?? 0) / ctx.inventoryCapacity;

  if (loadRatio > 0.5) return null;

  const diligence = ctx.personality?.diligence ?? 0.5;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: TASK_PRIORITIES.LOW + diligence * 0.15,
    params: {
      explorationType: "resource_scout",
      targetResource: "any",
    },
    source: "detector:explore:resources",
  });
}
