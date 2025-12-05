/**
 * @fileoverview Detector de Combate
 *
 * Detecta situaciones de combate y genera tareas de ataque o huida.
 * Cubre: ataques recibidos, amenazas cercanas, predadores.
 *
 * CLAVE: Si el agente es atacado múltiples veces, se generan múltiples
 * tareas de contraataque. TaskQueue las acumula y SUMA prioridad.
 *
 * @module domain/simulation/systems/agents/ai/detectors/CombatDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";
import { RandomUtils } from "@/shared/utils/RandomUtils";
import { RoleType } from "../../../../../../shared/constants/RoleEnums";
import { SocialStatus } from "../../../../../../shared/constants/AgentEnums";
import { SIMULATION_CONSTANTS } from "../../../../../../shared/constants/SimulationConstants";
import { logger } from "@/infrastructure/utils/logger";
import { distance } from "@/shared/utils/mathUtils";

const FLEE_HEALTH_THRESHOLD = SIMULATION_CONSTANTS.COMBAT.FLEE_HEALTH_THRESHOLD;
const PREDATOR_FLEE_DISTANCE =
  SIMULATION_CONSTANTS.COMBAT.PREDATOR_FLEE_DISTANCE;
const THREAT_ALERT_THRESHOLD =
  SIMULATION_CONSTANTS.COMBAT.THREAT_ALERT_THRESHOLD;

/**
 * Detecta situaciones de combate
 */
export function detectCombat(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (ctx.attackerId) {
    const healthRatio = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);

    if (healthRatio < FLEE_HEALTH_THRESHOLD) {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.FLEE,
          priority: TASK_PRIORITIES.CRITICAL,
          target: { entityId: ctx.attackerId },
          params: { reason: "low_health", healthRatio },
          source: "detector:combat:flee",
        }),
      );
    } else {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.ATTACK,
          priority: TASK_PRIORITIES.URGENT,
          target: { entityId: ctx.attackerId },
          params: { reason: "retaliation" },
          source: "detector:combat:attack",
        }),
      );
    }
  }

  if (ctx.nearbyPredators?.length) {
    const closest = ctx.nearbyPredators[0];
    const dist = distance(ctx.position, closest);

    if (dist < PREDATOR_FLEE_DISTANCE) {
      const isWarrior =
        ctx.roleType === SocialStatus.WARRIOR ||
        ctx.roleType === RoleType.GUARD;
      const hasWeapon = ctx.hasWeapon;
      const healthRatio = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);

      if (isWarrior && hasWeapon && healthRatio > 0.5) {
        tasks.push(
          createTask({
            agentId: ctx.agentId,
            type: TaskType.ATTACK,
            priority: TASK_PRIORITIES.CRITICAL,
            target: { entityId: closest.id, position: closest },
            params: { reason: "predator_defense", predatorType: closest.type },
            source: "detector:combat:predator_attack",
          }),
        );
      } else {
        tasks.push(
          createTask({
            agentId: ctx.agentId,
            type: TaskType.FLEE,
            priority: TASK_PRIORITIES.CRITICAL,
            target: { entityId: closest.id },
            params: {
              reason: "predator_panic",
              fleeDirection: calculateFleeDirection(ctx.position, closest),
            },
            source: "detector:combat:predator_flee",
          }),
        );
      }
    }
  }

  if (ctx.nearbyEnemies?.length && !ctx.attackerId) {
    const closest = ctx.nearbyEnemies[0];
    const dist = distance(ctx.position, closest);
    const isWarrior =
      ctx.roleType === SocialStatus.WARRIOR || ctx.roleType === RoleType.GUARD;

    if (isWarrior && ctx.hasWeapon && dist < 100) {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.ATTACK,
          priority: TASK_PRIORITIES.HIGH,
          target: { entityId: closest.id, position: closest },
          params: { reason: "proactive_defense" },
          source: "detector:combat:enemy",
        }),
      );
    }
  }

  if (
    ctx.threatLevel &&
    ctx.threatLevel > THREAT_ALERT_THRESHOLD &&
    !ctx.attackerId
  ) {
    if (ctx.threatLevel > 0.7) {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.FLEE,
          priority: TASK_PRIORITIES.URGENT,
          params: { reason: "high_threat", threatLevel: ctx.threatLevel },
          source: "detector:combat:threat",
        }),
      );
    } else {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.IDLE,
          priority: TASK_PRIORITIES.NORMAL,
          params: { reason: "alert", duration: 2000 },
          source: "detector:combat:alert",
        }),
      );
    }
  }

  if (tasks.length > 0 && RandomUtils.chance(0.1)) {
    logger.debug(
      `⚔️ [CombatDetector] ${ctx.agentId}: ${tasks.length} tasks, types=${tasks.map((t) => t.type).join(",")}`,
    );
  }

  return tasks;
}

function calculateFleeDirection(
  myPos: { x: number; y: number },
  threat: { x: number; y: number },
): { x: number; y: number } {
  const dx = myPos.x - threat.x;
  const dy = myPos.y - threat.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const scale = 150 / len; // Huir 150 unidades

  return {
    x: myPos.x + dx * scale,
    y: myPos.y + dy * scale,
  };
}
