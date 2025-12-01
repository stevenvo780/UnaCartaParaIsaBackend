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

// ============================================================================
// CONSTANTS
// ============================================================================

/** Tiempo mínimo entre exploraciones (ms) */
const EXPLORE_COOLDOWN = 60000; // 1 minuto
/** Tiempo largo sin explorar aumenta urgencia */
const EXPLORE_URGENCY_TIME = 300000; // 5 minutos

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta necesidad de explorar
 */
export function detectExplore(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // 1. Inspeccionar algo cercano e interesante
  const inspectTask = detectInspect(ctx);
  if (inspectTask) {
    tasks.push(inspectTask);
  }

  // 2. Exploración por curiosidad
  const exploreTask = detectCuriosityExplore(ctx);
  if (exploreTask) {
    tasks.push(exploreTask);
  }

  // 3. Búsqueda de recursos (si inventario bajo)
  const resourceScoutTask = detectResourceScout(ctx);
  if (resourceScoutTask) {
    tasks.push(resourceScoutTask);
  }

  return tasks;
}

// ============================================================================
// SUB-DETECTORS
// ============================================================================

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

  // Cooldown no pasado
  if (timeSinceExplore < EXPLORE_COOLDOWN) return null;

  const curiosity = ctx.personality?.curiosity ?? 0.5;

  // Calcular prioridad
  let priority = TASK_PRIORITIES.LOWEST + curiosity * 0.1;

  // Bonus si hace mucho que no explora
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
  // Solo si inventario bajo
  if (!ctx.inventoryCapacity) return null;

  const loadRatio = (ctx.inventoryLoad ?? 0) / ctx.inventoryCapacity;

  if (loadRatio > 0.5) return null; // Inventario suficientemente lleno

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
