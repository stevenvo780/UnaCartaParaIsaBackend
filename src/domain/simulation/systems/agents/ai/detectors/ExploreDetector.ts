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
import { SIMULATION_CONSTANTS } from "@/shared/constants/SimulationConstants";

import { GoalType } from "@/shared/constants/AIEnums";

/** Base tiempo mínimo entre exploraciones (ms) - actual value will have ±25% jitter */
const EXPLORE_COOLDOWN_BASE = 60000;
/** Base tiempo largo sin explorar aumenta urgencia - actual value will have ±25% jitter */
const EXPLORE_URGENCY_TIME_BASE = 300000;
/** Base cooldown más corto cuando hay urgencia de recursos */
const RESOURCE_SEARCH_COOLDOWN_BASE = 10000;
/** Maximum distance from CURRENT POSITION for exploration targets (not from map center) */
const MAX_EXPLORE_RADIUS = 2000;

/** 
 * Threshold below which agents should NOT explore (prioritize survival).
 * Increased to 50 to give agents more safety margin before exploring.
 * Agents need sufficient resources to make the journey and return.
 */
const SURVIVAL_THRESHOLD = 50;

/**
 * Applies ±25% jitter to a cooldown value for behavioral variety
 */
function getJitteredCooldown(baseValue: number): number {
  const jitter = 0.25; // ±25%
  const multiplier = 1 + RandomUtils.floatRange(-jitter, jitter);
  return Math.round(baseValue * multiplier);
}

/**
 * Detecta necesidad de explorar
 * IMPORTANTE: No genera tareas de exploración si las necesidades están bajas
 * para evitar que agentes mueran explorando lejos de recursos
 */
export function detectExplore(ctx: DetectorContext): Task[] {
  // If needs are low, don't explore - prioritize survival
  const hunger = ctx.needs?.hunger ?? 100;
  const thirst = ctx.needs?.thirst ?? 100;
  const energy = ctx.needs?.energy ?? 100;
  
  if (hunger < SURVIVAL_THRESHOLD || thirst < SURVIVAL_THRESHOLD || energy < SURVIVAL_THRESHOLD) {
    return []; // Don't generate explore tasks when survival is at stake
  }

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
  // Use jittered cooldown for variety
  if (timeSinceExplore < getJitteredCooldown(RESOURCE_SEARCH_COOLDOWN_BASE)) return null;

  // Explore in a direction away from current position to find new resources
  const exploreDistance = 300;

  let targetX = ctx.position.x;
  let targetY = ctx.position.y;

  // Move outward from current position in a random direction
  const angle = RandomUtils.floatRange(0, Math.PI * 2);
  targetX = ctx.position.x + Math.cos(angle) * exploreDistance;
  targetY = ctx.position.y + Math.sin(angle) * exploreDistance;

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

  // Use jittered cooldown for variety
  if (timeSinceExplore < getJitteredCooldown(EXPLORE_COOLDOWN_BASE)) return null;

  // No distance limit - infinite procedural world allows exploration anywhere

  const curiosity = ctx.personality?.curiosity ?? 0.5;

  let priority = TASK_PRIORITIES.LOWEST + curiosity * 0.1;

  // Use jittered urgency time
  if (timeSinceExplore > getJitteredCooldown(EXPLORE_URGENCY_TIME_BASE)) {
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
  // Use jittered cooldown for variety
  if (timeSinceExplore < getJitteredCooldown(EXPLORE_COOLDOWN_BASE)) return null;

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
 * Aplica límite de distancia para evitar que agentes se alejen demasiado.
 * Adds randomization to avoid all agents exploring the same zones.
 */
function findUnexploredZone(
  ctx: DetectorContext,
): { id: string; x: number; y: number } | null {
  const allZones = ctx.allZones;
  const visitedZones = ctx.visitedZones;

  if (!allZones || allZones.length === 0) return null;

  const agentPos = ctx.position;

  // Filter zones by distance from AGENT (not from center) - use MAX_EXPLORE_RADIUS
  const zonesInRange = allZones.filter((z) => {
    const dist = Math.hypot(z.x - agentPos.x, z.y - agentPos.y);
    return dist <= MAX_EXPLORE_RADIUS;
  });

  if (zonesInRange.length === 0) return null;

  const unvisited = zonesInRange.filter((z) => !visitedZones?.has(z.id));

  // If all zones are visited, return null to trigger random exploration outward
  // This pushes agents to discover new chunks instead of revisiting known zones
  if (unvisited.length === 0) {
    return null;
  }

  // Sort by distance
  unvisited.sort((a, b) => {
    const distA = Math.hypot(a.x - agentPos.x, a.y - agentPos.y);
    const distB = Math.hypot(b.x - agentPos.x, b.y - agentPos.y);
    return distA - distB;
  });

  // VARIABILITY: 70% choose from top 3 closest, 30% choose random from all unvisited
  // This prevents all agents from converging on the exact same zone
  if (RandomUtils.chance(0.3) && unvisited.length > 3) {
    const randomIndex = RandomUtils.intRange(0, unvisited.length - 1);
    return unvisited[randomIndex];
  }

  // Choose from top 3 closest (or less if fewer available)
  const topCandidates = unvisited.slice(0, Math.min(3, unvisited.length));
  const selectedIndex = RandomUtils.intRange(0, topCandidates.length - 1);
  return topCandidates[selectedIndex];
}
