/**
 * @fileoverview Detector de Trabajo
 *
 * Detecta cuando un agente debe trabajar según su rol.
 * Cubre: recolección, caza, trabajo según rol.
 *
 * @module domain/simulation/systems/agents/ai/detectors/WorkDetector
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

/** No trabajar si necesidades críticas */
const CRITICAL_NEED_THRESHOLD = 15;

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta necesidad de trabajar
 */
export function detectWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // No trabajar si:
  // - No es hora de trabajo
  // - Está en combate
  // - Necesidades críticas
  if (!ctx.isWorkHours) return tasks;
  if (ctx.isInCombat) return tasks;

  const hunger = ctx.needs?.hunger ?? 100;
  const energy = ctx.needs?.energy ?? 100;
  if (hunger < CRITICAL_NEED_THRESHOLD || energy < CRITICAL_NEED_THRESHOLD) {
    return tasks;
  }

  const role = (ctx.roleType ?? "").toLowerCase();

  switch (role) {
    case "gatherer":
    case "worker":
      tasks.push(...detectGatherWork(ctx));
      break;

    case "hunter":
      tasks.push(...detectHuntWork(ctx));
      break;

    case "builder":
      // Construcción se maneja en BuildDetector
      break;

    case "warrior":
    case "guard":
      tasks.push(...detectPatrolWork(ctx));
      break;

    case "crafter":
      // Crafteo se maneja en CraftDetector
      break;

    case "trader":
      // Comercio se maneja en TradeDetector
      break;

    default:
      // Rol genérico → recolectar si hay recursos
      if (ctx.nearestResource) {
        tasks.push(...detectGatherWork(ctx));
      }
  }

  return tasks;
}

// ============================================================================
// SUB-DETECTORS
// ============================================================================

function detectGatherWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.nearestResource) return tasks;

  const priority = calculateWorkPriority(ctx);

  tasks.push(
    createTask({
      agentId: ctx.agentId,
      type: TaskType.GATHER,
      priority,
      target: {
        entityId: ctx.nearestResource.id,
        position: ctx.nearestResource,
      },
      params: { resourceType: ctx.nearestResource.type },
      source: "detector:work:gather",
    }),
  );

  return tasks;
}

function detectHuntWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // Necesita arma para cazar
  if (!ctx.hasWeapon) return tasks;

  // Buscar presa (puede ser detectada por sistema externo)
  const priority = calculateWorkPriority(ctx) * 1.1; // Caza ligeramente más prioritaria

  tasks.push(
    createTask({
      agentId: ctx.agentId,
      type: TaskType.HUNT,
      priority,
      params: { targetType: "prey" },
      source: "detector:work:hunt",
    }),
  );

  return tasks;
}

function detectPatrolWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // Patrullar = explorar con propósito defensivo
  const priority = TASK_PRIORITIES.LOW;

  tasks.push(
    createTask({
      agentId: ctx.agentId,
      type: TaskType.EXPLORE,
      priority,
      params: { reason: "patrol", defensive: true },
      source: "detector:work:patrol",
    }),
  );

  return tasks;
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateWorkPriority(ctx: DetectorContext): number {
  let priority = TASK_PRIORITIES.NORMAL;

  // Bonus por diligencia
  const diligence = ctx.personality?.diligence ?? 0.5;
  priority += diligence * 0.2;

  // Bonus si inventario vacío
  const loadRatio =
    ctx.inventoryLoad && ctx.inventoryCapacity
      ? ctx.inventoryLoad / ctx.inventoryCapacity
      : 0;

  if (loadRatio < 0.3) {
    priority += 0.1; // Más urgente si casi vacío
  }

  return Math.min(0.9, priority);
}
