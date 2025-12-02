/**
 * @fileoverview Detector de Necesidades - Router Pattern
 *
 * Este detector es un ROUTER PURO que delega la lógica al NeedsSystem.
 * NO reimplementa umbrales ni prioridades - usa constantes centralizadas.
 *
 * Flujo:
 * 1. Detector recibe contexto con posición y spatial data
 * 2. Consulta NeedsSystem.getPendingTasks()
 * 3. Convierte los descriptores a tareas completas
 * 4. Retorna las tareas para ser encoladas
 *
 * @module domain/simulation/systems/agents/ai/detectors/NeedsDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  createTask,
} from "../types";
import { logger } from "@/infrastructure/utils/logger";
import { SIMULATION_CONSTANTS } from "@/shared/constants/SimulationConstants";

// Use centralized thresholds
const THRESHOLDS = {
  CRITICAL: SIMULATION_CONSTANTS.NEEDS.CRITICAL_THRESHOLD,
  URGENT: SIMULATION_CONSTANTS.NEEDS.LOW_THRESHOLD,
  LOW: SIMULATION_CONSTANTS.NEEDS.URGENT_THRESHOLD,
} as const;

const PRIORITIES = SIMULATION_CONSTANTS.PRIORITIES;

// Default TTL for needs tasks (15 seconds - gives time to find resources)
const NEEDS_TASK_TTL_MS = 15000;

/**
 * Helper: obtiene el mejor recurso (nearestX o knownResources fallback).
 * Retorna target para la tarea o undefined si no hay recurso.
 */
function getBestResourceTarget(
  ctx: DetectorContext,
  resourceType: "food" | "water",
): { entityId: string; position: { x: number; y: number } } | undefined {
  // Primero: recurso cercano detectado por WorldQueryService
  if (resourceType === "food" && ctx.nearestFood) {
    return { entityId: ctx.nearestFood.id, position: ctx.nearestFood };
  }
  if (resourceType === "water" && ctx.nearestWater) {
    return { entityId: ctx.nearestWater.id, position: ctx.nearestWater };
  }

  // Fallback: recurso conocido en memoria
  if (ctx.knownResources) {
    const known = ctx.knownResources.get(resourceType);
    if (known) {
      logger.debug(`[NeedsDetector] ${ctx.agentId}: usando recurso conocido ${resourceType} en (${known.x.toFixed(0)},${known.y.toFixed(0)})`);
      return { entityId: `memory_${resourceType}`, position: known };
    }
  }

  return undefined;
}

/**
 * Router que consulta al NeedsSystem por tareas pendientes.
 * Usa constantes centralizadas de SIMULATION_CONSTANTS.
 */
export function detectNeeds(ctx: DetectorContext): Task[] {
  // Early exit if no needs context
  if (!ctx.needs) {
    // Debug log occasionally
    if (Math.random() < 0.01) {
      logger.debug(`[NeedsDetector] ${ctx.agentId}: no needs data`);
    }
    return [];
  }

  // Debug log needs periodically
  if (Math.random() < 0.02) {
    logger.debug(
      `[NeedsDetector] ${ctx.agentId}: hunger=${ctx.needs.hunger?.toFixed(0)}, thirst=${ctx.needs.thirst?.toFixed(0)}, energy=${ctx.needs.energy?.toFixed(0)} (thresholds LOW=${THRESHOLDS.LOW})`,
    );
  }

  const tasks: Task[] = [];

  const calcPriority = (v: number) => {
    if (v < THRESHOLDS.CRITICAL) return PRIORITIES.CRITICAL;
    if (v < THRESHOLDS.URGENT) return PRIORITIES.URGENT;
    return PRIORITIES.HIGH;
  };

  const calcSocialPriority = (v: number) => {
    if (v < THRESHOLDS.CRITICAL) return PRIORITIES.HIGH;
    if (v < THRESHOLDS.URGENT) return PRIORITIES.NORMAL;
    return PRIORITIES.LOW;
  };

  // Hunger
  const hunger = ctx.needs.hunger ?? 100;
  if (hunger < THRESHOLDS.LOW) {
    const foodTarget = getBestResourceTarget(ctx, "food");
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SATISFY_NEED,
        priority: calcPriority(hunger),
        target: foodTarget,
        params: { needType: "hunger", resourceType: "food" },
        source: "needs:hunger",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Thirst
  const thirst = ctx.needs.thirst ?? 100;
  if (thirst < THRESHOLDS.LOW) {
    const waterTarget = getBestResourceTarget(ctx, "water");
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SATISFY_NEED,
        priority: calcPriority(thirst),
        target: waterTarget,
        params: { needType: "thirst", resourceType: "water" },
        source: "needs:thirst",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Energy
  const energy = ctx.needs.energy ?? 100;
  if (energy < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.REST,
        priority: calcPriority(energy),
        params: { needType: "energy", duration: 5000 },
        source: "needs:energy",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Social
  const social = ctx.needs.social ?? 100;
  if (social < THRESHOLDS.LOW && ctx.nearbyAgents?.length) {
    const target = ctx.nearbyAgents[0];
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SOCIALIZE,
        priority: calcSocialPriority(social),
        target: { entityId: target.id, position: target },
        params: { needType: "social" },
        source: "needs:social",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Fun
  const fun = ctx.needs.fun ?? 100;
  if (fun < THRESHOLDS.LOW && ctx.nearbyAgents?.length) {
    const target = ctx.nearbyAgents[0];
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SOCIALIZE,
        priority: calcSocialPriority(fun) * 0.9,
        target: { entityId: target.id, position: target },
        params: { needType: "fun", action: "play" },
        source: "needs:fun",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Mental health
  const mentalHealth = ctx.needs.mentalHealth ?? 100;
  if (mentalHealth < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.REST,
        priority: calcSocialPriority(mentalHealth),
        params: { needType: "mental_health", action: "meditate" },
        source: "needs:mental",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  // Log when tasks are generated
  if (tasks.length > 0 && Math.random() < 0.1) {
    logger.debug(
      `[NeedsDetector] ${ctx.agentId}: ${tasks.length} tasks generated. ` +
      `Needs: h=${Math.round(hunger)}, t=${Math.round(thirst)}, e=${Math.round(energy)}`
    );
  }

  return tasks;
}
