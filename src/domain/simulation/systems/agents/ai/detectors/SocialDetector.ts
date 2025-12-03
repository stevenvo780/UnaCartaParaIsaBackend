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
import { GoalReason } from "../../../../../../shared/constants/AIEnums";
import { SIMULATION_CONSTANTS } from "../../../../../../shared/constants/SimulationConstants";
import { logger } from "@/infrastructure/utils/logger";

/** Bienestar mínimo para reproducirse - usa constante centralizada */
const REPRODUCTION_WELLNESS_THRESHOLD = SIMULATION_CONSTANTS.SOCIAL.REPRODUCTION_WELLNESS_THRESHOLD;

/**
 * Detecta necesidades y oportunidades sociales
 */
export function detectSocial(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  const reproductionTask = detectReproduction(ctx);
  if (reproductionTask) {
    tasks.push(reproductionTask);
  }

  const assistTask = detectAssist(ctx);
  if (assistTask) {
    tasks.push(assistTask);
  }

  if (tasks.length > 0 && Math.random() < 0.05) {
    logger.debug(
      `💬 [SocialDetector] ${ctx.agentId}: ${tasks.length} tasks (repro=${!!reproductionTask}, assist=${!!assistTask})`,
    );
  }

  return tasks;
}

function detectReproduction(ctx: DetectorContext): Task | null {
  if (!ctx.needs) return null;

  const wellness = calculateWellness(ctx);
  if (wellness < REPRODUCTION_WELLNESS_THRESHOLD) return null;

  if (!ctx.potentialMate) return null;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.SOCIALIZE,
    priority: calculateReproductionPriority(wellness),
    target: { entityId: ctx.potentialMate.id, position: ctx.potentialMate },
    params: {
      action: "find_mate",
      reason: GoalReason.REPRODUCTION_DRIVE,
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

function calculateWellness(ctx: DetectorContext): number {
  const health = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);
  const energy = (ctx.needs?.energy ?? 100) / 100;
  const hunger = (ctx.needs?.hunger ?? 100) / 100;
  const thirst = (ctx.needs?.thirst ?? 100) / 100;

  return health * 0.3 + energy * 0.3 + hunger * 0.2 + thirst * 0.2;
}

function calculateReproductionPriority(wellness: number): number {
  const drive = (wellness - REPRODUCTION_WELLNESS_THRESHOLD) * 5;
  return Math.min(TASK_PRIORITIES.HIGH, TASK_PRIORITIES.LOW + drive * 0.3);
}
