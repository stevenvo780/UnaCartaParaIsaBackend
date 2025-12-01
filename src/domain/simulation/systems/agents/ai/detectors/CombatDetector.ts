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

// ============================================================================
// CONSTANTS
// ============================================================================

const FLEE_HEALTH_THRESHOLD = 0.2; // Huir si salud < 20%
const PREDATOR_FLEE_DISTANCE = 80; // Huir si predador más cerca
const THREAT_ALERT_THRESHOLD = 0.3; // Alertarse si amenaza > 30%

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta situaciones de combate
 */
export function detectCombat(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // 1. Si fue atacado → contraatacar o huir
  if (ctx.attackerId) {
    const healthRatio = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);

    if (healthRatio < FLEE_HEALTH_THRESHOLD) {
      // Salud muy baja → HUIR
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
      // Contraatacar
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

  // 2. Predadores cercanos
  if (ctx.nearbyPredators?.length) {
    const closest = ctx.nearbyPredators[0];
    const dist = distance(ctx.position, closest);

    if (dist < PREDATOR_FLEE_DISTANCE) {
      // Predador muy cerca
      const isWarrior = ctx.roleType === "warrior" || ctx.roleType === "guard";
      const hasWeapon = ctx.hasWeapon;
      const healthRatio = (ctx.health ?? 100) / (ctx.maxHealth ?? 100);

      if (isWarrior && hasWeapon && healthRatio > 0.5) {
        // Guerrero armado y sano → atacar
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
        // No guerrero o débil → huir
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

  // 3. Enemigos cercanos (no atacando aún)
  if (ctx.nearbyEnemies?.length && !ctx.attackerId) {
    const closest = ctx.nearbyEnemies[0];
    const dist = distance(ctx.position, closest);
    const isWarrior = ctx.roleType === "warrior" || ctx.roleType === "guard";

    if (isWarrior && ctx.hasWeapon && dist < 100) {
      // Guerrero ve enemigo → atacar
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

  // 4. Nivel de amenaza alto (sin atacante específico)
  if (
    ctx.threatLevel &&
    ctx.threatLevel > THREAT_ALERT_THRESHOLD &&
    !ctx.attackerId
  ) {
    if (ctx.threatLevel > 0.7) {
      // Amenaza muy alta → huir
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
      // Amenaza moderada → alerta (idle defensivo)
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

  return tasks;
}

// ============================================================================
// HELPERS
// ============================================================================

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
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
