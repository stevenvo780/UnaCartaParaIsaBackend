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
import { RoleType } from "../../../../../../shared/constants/RoleEnums";
import { SocialStatus } from "../../../../../../shared/constants/AgentEnums";
import { SIMULATION_CONSTANTS } from "../../../../../../shared/constants/SimulationConstants";
import { logger } from "@/infrastructure/utils/logger";

/** No trabajar si necesidades críticas - usa constante centralizada */
const CRITICAL_NEED_THRESHOLD = SIMULATION_CONSTANTS.NEEDS.CRITICAL_THRESHOLD;

/**
 * Detecta necesidad de trabajar
 */
export function detectWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.isWorkHours) return tasks;
  if (ctx.isInCombat) return tasks;

  const hunger = ctx.needs?.hunger ?? 100;
  const energy = ctx.needs?.energy ?? 100;
  if (hunger < CRITICAL_NEED_THRESHOLD || energy < CRITICAL_NEED_THRESHOLD) {
    return tasks;
  }

  const role = (ctx.roleType ?? "").toLowerCase();

  switch (role) {
    case RoleType.GATHERER:
    case "worker":
      tasks.push(...detectGatherWork(ctx));
      break;

    case RoleType.HUNTER:
      tasks.push(...detectHuntWork(ctx));
      break;

    case RoleType.BUILDER:
      break;

    case SocialStatus.WARRIOR:
    case RoleType.GUARD:
      tasks.push(...detectPatrolWork(ctx));
      break;

    case "crafter":
      break;

    case "trader":
      break;

    default:
      if (ctx.nearestResource) {
        tasks.push(...detectGatherWork(ctx));
      }
  }

  if (tasks.length > 0 && Math.random() < 0.05) {
    logger.debug(
      `🔨 [WorkDetector] ${ctx.agentId}: role=${role}, ${tasks.length} tasks`,
    );
  }

  return tasks;
}

function detectGatherWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // Priorizar materiales de construcción cuando hay demanda del BuildingSystem
  if (ctx.hasBuildingResourceDemand) {
    // Priorizar madera si hay árboles cercanos y se necesita wood
    if (ctx.nearestTree && ctx.buildingResourceNeeds?.wood && ctx.buildingResourceNeeds.wood > 0) {
      const priority = calculateWorkPriority(ctx) * 1.2; // Mayor prioridad
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.GATHER,
          priority,
          target: {
            entityId: ctx.nearestTree.id,
            position: ctx.nearestTree,
          },
          params: { resourceType: ctx.nearestTree.type, forConstruction: true },
          source: "detector:work:gather:tree",
        }),
      );
      if (Math.random() < 0.1) {
        logger.debug(
          `🌲 [WorkDetector] ${ctx.agentId}: prioritizing TREE for construction demand`,
        );
      }
      return tasks;
    }
    // Si no hay madera pendiente o árboles, buscar piedra
    if (ctx.nearestStone && ctx.buildingResourceNeeds?.stone && ctx.buildingResourceNeeds.stone > 0) {
      const priority = calculateWorkPriority(ctx) * 1.2;
      tasks.push(
        createTask({
          agentId: ctx.agentId,
          type: TaskType.GATHER,
          priority,
          target: {
            entityId: ctx.nearestStone.id,
            position: ctx.nearestStone,
          },
          params: { resourceType: ctx.nearestStone.type, forConstruction: true },
          source: "detector:work:gather:stone",
        }),
      );
      if (Math.random() < 0.1) {
        logger.debug(
          `🪨 [WorkDetector] ${ctx.agentId}: prioritizing STONE for construction demand`,
        );
      }
      return tasks;
    }
  }

  // Comportamiento normal: usar nearestResource (from WorldResourceSystem)
  if (ctx.nearestResource) {
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

  // Fallback: use work zones with items (from ItemGenerationSystem)
  if (ctx.workZonesWithItems && ctx.workZonesWithItems.length > 0) {
    const priority = calculateWorkPriority(ctx);

    // Pick the closest work zone
    const nearestZone = ctx.workZonesWithItems[0];

    tasks.push(
      createTask({
        agentId: ctx.agentId,
        type: TaskType.GATHER,
        priority,
        target: {
          zoneId: nearestZone.zoneId,
          position: { x: nearestZone.x, y: nearestZone.y },
        },
        params: {
          resourceType: nearestZone.items[0]?.itemId ?? "wood_log",
          fromZone: true,
        },
        source: "detector:work:gather:zone",
      }),
    );

    if (Math.random() < 0.1) {
      logger.debug(
        `🔨 [WorkDetector] ${ctx.agentId}: gather from zone ${nearestZone.zoneId}`,
      );
    }
  }

  return tasks;
}

function detectHuntWork(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.hasWeapon) return tasks;

  const priority = calculateWorkPriority(ctx) * 1.1;

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

function calculateWorkPriority(ctx: DetectorContext): number {
  let priority = TASK_PRIORITIES.NORMAL;

  const diligence = ctx.personality?.diligence ?? 0.5;
  priority += diligence * 0.2;

  const loadRatio =
    ctx.inventoryLoad && ctx.inventoryCapacity
      ? ctx.inventoryLoad / ctx.inventoryCapacity
      : 0;

  if (loadRatio < 0.3) {
    priority += 0.1;
  }

  return Math.min(0.9, priority);
}
