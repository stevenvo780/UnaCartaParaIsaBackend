/**
 * @fileoverview Detector de Exploración
 *
 * Detecta cuando un agente debería explorar.
 * Cubre: curiosidad, búsqueda de recursos, inspección.
 * Prioriza zonas no visitadas usando la memoria del agente.
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
import { RandomUtils } from "@/shared/utils/RandomUtils";
import { logger } from "@/infrastructure/utils/logger";

import { GoalType } from "@/shared/constants/AIEnums";
/** Tiempo mínimo entre exploraciones (ms) */
const EXPLORE_COOLDOWN = 60000;
/** Tiempo largo sin explorar aumenta urgencia */
const EXPLORE_URGENCY_TIME = 300000;
/** Cooldown más corto cuando hay urgencia de recursos */
const RESOURCE_SEARCH_COOLDOWN = 10000;

/**
 * Detecta necesidad de explorar
 */
export function detectExplore(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  const urgentResourceSearch = detectUrgentResourceSearch(ctx);
  if (urgentResourceSearch) {
    tasks.push(urgentResourceSearch);
  }

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

  if (tasks.length > 0 && RandomUtils.chance(0.02)) {
    logger.debug(`🧭 [ExploreDetector] ${ctx.agentId}: ${tasks.length} tasks`);
  }

  return tasks;
}

/**
 * Detecta urgencia de buscar recursos cuando hay demanda pero no hay recursos cercanos.
 * Prioridad más alta que exploración normal para que agentes busquen nuevos chunks.
 */
function detectUrgentResourceSearch(ctx: DetectorContext): Task | null {
  if (!ctx.hasBuildingResourceDemand) return null;

  if (ctx.nearestTree || ctx.nearestStone || ctx.nearestResource) return null;

  const lastExplore = ctx.lastExploreTime ?? 0;
  const timeSinceExplore = ctx.now - lastExplore;
  if (timeSinceExplore < RESOURCE_SEARCH_COOLDOWN) return null;

  const distFromCenter = Math.hypot(ctx.position.x, ctx.position.y);
  const exploreDistance = 300;

  let targetX = ctx.position.x;
  let targetY = ctx.position.y;

  if (distFromCenter > 10) {
    const angle = Math.atan2(ctx.position.y, ctx.position.x);
    targetX = ctx.position.x + Math.cos(angle) * exploreDistance;
    targetY = ctx.position.y + Math.sin(angle) * exploreDistance;
  } else {
    const angle = RandomUtils.floatRange(0, Math.PI * 2);
    targetX = ctx.position.x + Math.cos(angle) * exploreDistance;
    targetY = ctx.position.y + Math.sin(angle) * exploreDistance;
  }

  if (RandomUtils.chance(0.1)) {
    logger.debug(
      `🔍 [ExploreDetector] ${ctx.agentId}: urgent resource search, no resources nearby, moving to (${Math.round(targetX)}, ${Math.round(targetY)})`,
    );
  }

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: TASK_PRIORITIES.NORMAL + 0.2,
    target: {
      position: { x: targetX, y: targetY },
    },
    params: {
      explorationType: "urgent_resource_search",
      reason: "no_resources_nearby",
    },
    source: "detector:explore:urgent_resources",
  });
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
    params: { explorationType: GoalType.INSPECT },
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

  const unexploredZone = findUnexploredZone(ctx);

  if (unexploredZone) {
    priority += 0.1;
  }

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: Math.min(TASK_PRIORITIES.NORMAL, priority),
    target: unexploredZone
      ? {
          zoneId: unexploredZone.id,
          position: { x: unexploredZone.x, y: unexploredZone.y },
        }
      : undefined,
    params: {
      explorationType: "curiosity",
      reason: unexploredZone ? "discover_new_area" : "cognitive_drive",
    },
    source: "detector:explore:curiosity",
  });
}

function detectResourceScout(ctx: DetectorContext): Task | null {
  const lastExplore = ctx.lastExploreTime ?? 0;
  const timeSinceExplore = ctx.now - lastExplore;
  if (timeSinceExplore < EXPLORE_COOLDOWN) return null;

  if (!ctx.inventoryCapacity) return null;

  const loadRatio = (ctx.inventoryLoad ?? 0) / ctx.inventoryCapacity;

  if (loadRatio > 0.5) return null;

  const diligence = ctx.personality?.diligence ?? 0.5;

  const unexploredZone = findUnexploredZone(ctx);

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.EXPLORE,
    priority: TASK_PRIORITIES.LOW + diligence * 0.15,
    target: unexploredZone
      ? {
          zoneId: unexploredZone.id,
          position: { x: unexploredZone.x, y: unexploredZone.y },
        }
      : undefined,
    params: {
      explorationType: "resource_scout",
      targetResource: "any",
    },
    source: "detector:explore:resources",
  });
}

/**
 * Encuentra una zona no visitada para explorar.
 * Prioriza zonas cercanas que no estén en visitedZones.
 */
function findUnexploredZone(
  ctx: DetectorContext,
): { id: string; x: number; y: number } | null {
  const allZones = ctx.allZones;
  const visitedZones = ctx.visitedZones;

  if (!allZones || allZones.length === 0) return null;

  const unvisited = allZones.filter((z) => !visitedZones?.has(z.id));

  if (unvisited.length === 0) {
    const randomIndex = RandomUtils.intRange(0, allZones.length - 1);
    return allZones[randomIndex];
  }

  const agentPos = ctx.position;
  unvisited.sort((a, b) => {
    const distA = Math.hypot(a.x - agentPos.x, a.y - agentPos.y);
    const distB = Math.hypot(b.x - agentPos.x, b.y - agentPos.y);
    return distA - distB;
  });

  return unvisited[0];
}
