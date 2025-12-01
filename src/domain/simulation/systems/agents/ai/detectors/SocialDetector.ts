/**
 * @fileoverview Detector Social
 *
 * Detecta oportunidades y necesidades sociales.
 * Cubre: reproducción, asistencia a otros, interacciones.
 *
 * @module domain/simulation/systems/agents/ai/detectors/SocialDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";
import { NeedType } from "@/shared/constants/AIEnums";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Bienestar mínimo para reproducirse */
const REPRODUCTION_WELLNESS_THRESHOLD = 0.8;

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta necesidades y oportunidades sociales
 */
export function detectSocial(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // 1. Reproducción (si bienestar alto)
  const reproductionTask = detectReproduction(ctx);
  if (reproductionTask) {
    tasks.push(reproductionTask);
  }

  // 2. Asistir a otro agente necesitado
  const assistTask = detectAssist(ctx);
  if (assistTask) {
    tasks.push(assistTask);
  }

  return tasks;
}

// ============================================================================
// SUB-DETECTORS
// ============================================================================

function detectReproduction(ctx: DetectorContext): Task | null {
  if (!ctx.needs) return null;

  // Calcular bienestar general
  const wellness = calculateWellness(ctx);
  if (wellness < REPRODUCTION_WELLNESS_THRESHOLD) return null;

  // Buscar pareja potencial
  if (!ctx.potentialMate) return null;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.SOCIALIZE,
    priority: calculateReproductionPriority(wellness),
    target: { entityId: ctx.potentialMate.id, position: ctx.potentialMate },
    params: {
      action: "find_mate",
      reason: "reproduction_drive",
    },
    source: "detector:social:reproduction",
  });
}

function detectAssist(ctx: DetectorContext): Task | null {
  if (!ctx.nearbyAgentInNeed) return null;
  if (!ctx.nearbyAgentInNeed.targetZoneId) return null;

  const sociability = ctx.personality?.sociability ?? 0.5;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.ASSIST,
    priority: TASK_PRIORITIES.NORMAL + sociability * 0.2,
    target: { zoneId: ctx.nearbyAgentInNeed.targetZoneId },
    params: {
      targetAgentId: ctx.nearbyAgentInNeed.id,
      need: ctx.nearbyAgentInNeed.need as unknown as NeedType,
      amount: 10,
    },
    source: "detector:social:assist",
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateWellness(ctx: DetectorContext): number {
  const health = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);
  const energy = (ctx.needs?.energy ?? 100) / 100;
  const hunger = (ctx.needs?.hunger ?? 100) / 100;
  const thirst = (ctx.needs?.thirst ?? 100) / 100;

  // Promedio ponderado
  return health * 0.3 + energy * 0.3 + hunger * 0.2 + thirst * 0.2;
}

function calculateReproductionPriority(wellness: number): number {
  // Solo activo cuando wellness > threshold
  // Prioridad aumenta con wellness
  const drive = (wellness - REPRODUCTION_WELLNESS_THRESHOLD) * 5;
  return Math.min(TASK_PRIORITIES.HIGH, TASK_PRIORITIES.LOW + drive * 0.3);
}
