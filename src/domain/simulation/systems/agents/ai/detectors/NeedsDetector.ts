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
import { RandomUtils } from "@/shared/utils/RandomUtils";
import { logger } from "@/infrastructure/utils/logger";
import { SIMULATION_CONSTANTS } from "@/shared/constants/SimulationConstants";
import { ResourceType } from "@/shared/constants/ResourceEnums";
import { NeedType } from "@/shared/constants/AIEnums";

import { ZoneType } from "@/shared/constants/ZoneEnums";
const THRESHOLDS = {
  CRITICAL: SIMULATION_CONSTANTS.NEEDS.CRITICAL_THRESHOLD,
  URGENT: SIMULATION_CONSTANTS.NEEDS.LOW_THRESHOLD,
  LOW: SIMULATION_CONSTANTS.NEEDS.URGENT_THRESHOLD,
} as const;

const PRIORITIES = SIMULATION_CONSTANTS.PRIORITIES;

const NEEDS_TASK_TTL_MS = 15000;

/**
 * Helper: obtiene el mejor recurso (nearestX o knownResources fallback).
 * Retorna target para la tarea o undefined si no hay recurso.
 */
function getBestResourceTarget(
  ctx: DetectorContext,
  resourceType: ResourceType.FOOD | ResourceType.WATER,
): { entityId: string; position: { x: number; y: number } } | undefined {
  if (resourceType === ResourceType.FOOD && ctx.nearestFood) {
    return { entityId: ctx.nearestFood.id, position: ctx.nearestFood };
  }
  if (resourceType === ResourceType.WATER && ctx.nearestWater) {
    return { entityId: ctx.nearestWater.id, position: ctx.nearestWater };
  }

  if (ctx.knownResources) {
    const known = ctx.knownResources.get(resourceType);
    if (known) {
      logger.debug(
        `[NeedsDetector] ${ctx.agentId}: usando recurso conocido ${resourceType} en (${known.x.toFixed(0)},${known.y.toFixed(0)})`,
      );
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
  if (!ctx.needs) {
    return [];
  }

  const tasks: Task[] = [];

  if (RandomUtils.chance(0.02)) {
    logger.debug(
      `[NeedsDetector] ${ctx.agentId}: h=${ctx.needs.hunger?.toFixed(0)}, t=${ctx.needs.thirst?.toFixed(0)}, e=${ctx.needs.energy?.toFixed(0)}`,
    );
  }

  const calcPriority = (v: number): number => {
    if (v < THRESHOLDS.CRITICAL) return PRIORITIES.CRITICAL;
    if (v < THRESHOLDS.URGENT) return PRIORITIES.URGENT;
    return PRIORITIES.HIGH;
  };

  const calcSocialPriority = (v: number): number => {
    if (v < THRESHOLDS.CRITICAL) return PRIORITIES.HIGH;
    if (v < THRESHOLDS.URGENT) return PRIORITIES.NORMAL;
    return PRIORITIES.LOW;
  };

  const hunger = ctx.needs.hunger ?? 100;
  if (hunger < THRESHOLDS.LOW) {
    const foodTarget = getBestResourceTarget(ctx, ResourceType.FOOD);
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.SATISFY_NEED,
        priority: calcPriority(hunger),
        target: foodTarget,
        params: { needType: NeedType.HUNGER, resourceType: ResourceType.FOOD },
        source: "needs:hunger",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

  const thirst = ctx.needs.thirst ?? 100;
  if (thirst < THRESHOLDS.LOW) {
    const waterTarget = getBestResourceTarget(ctx, ResourceType.WATER);

    if (waterTarget) {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.SATISFY_NEED,
          priority: calcPriority(thirst),
          target: waterTarget,
          params: {
            needType: NeedType.THIRST,
            resourceType: ResourceType.WATER,
          },
          source: "needs:thirst",
          ttlMs: NEEDS_TASK_TTL_MS,
        }),
      );
    } else {
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.EXPLORE,
          priority: calcPriority(thirst),
          params: {
            reason: "searching_water",
            preferEdge: true,
          },
          source: "needs:thirst:explore",
          ttlMs: NEEDS_TASK_TTL_MS * 2,
        }),
      );
    }
  }

  const energy = ctx.needs.energy ?? 100;
  if (energy < THRESHOLDS.LOW) {
    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.REST,
        priority: calcPriority(energy),
        params: { needType: NeedType.ENERGY, duration: 5000 },
        source: "needs:energy",
        ttlMs: NEEDS_TASK_TTL_MS,
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
        priority: calcSocialPriority(social),
        target: { entityId: target.id, position: target },
        params: { needType: NeedType.SOCIAL },
        source: "needs:social",
        ttlMs: NEEDS_TASK_TTL_MS,
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
        priority: calcSocialPriority(fun) * 0.9,
        target: { entityId: target.id, position: target },
        params: { needType: NeedType.FUN, action: ZoneType.PLAY },
        source: "needs:fun",
        ttlMs: NEEDS_TASK_TTL_MS,
      }),
    );
  }

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

  if (tasks.length > 0 && RandomUtils.chance(0.1)) {
    logger.debug(
      `[NeedsDetector] ${ctx.agentId}: ${tasks.length} tasks generated. ` +
        `Needs: h=${Math.round(hunger)}, t=${Math.round(thirst)}, e=${Math.round(energy)}`,
    );
  }

  return tasks;
}
