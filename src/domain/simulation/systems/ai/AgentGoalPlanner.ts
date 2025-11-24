import type { GameState } from "../../../types/game-types";
import type {
  AIGoal,
  AIState,
  AgentPersonality,
} from "../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { PriorityManager } from "./PriorityManager";
import {
  calculateNeedPriority,
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getRecommendedZoneIdsForNeed,
  getEntityPosition,
} from "./utils";

export interface AgentGoalPlannerDeps {
  gameState: GameState;
  priorityManager: PriorityManager;
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
}

/**
 * Plans goals for an agent based on their needs, personality, and game state
 */
export function planGoals(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  minPriority: number = 0.3,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);

  if (!entityNeeds) {
    // If no needs, explore
    return createDefaultExplorationGoals(aiState, deps.gameState, now);
  }

  // 1. Evaluate Critical Needs
  const criticalGoals = evaluateCriticalNeeds(deps, aiState, entityNeeds, now);
  goals.push(...criticalGoals);

  // 2. Evaluate Opportunities (if not in critical state)
  if (criticalGoals.length === 0 || criticalGoals[0].priority < 0.7) {
    const opportunityGoals = evaluateOpportunities(deps, aiState, now);
    goals.push(...opportunityGoals);
  }

  // 3. Default exploration if nothing else
  if (goals.length === 0) {
    const defaultGoals = createDefaultExplorationGoals(
      aiState,
      deps.gameState,
      now,
    );
    goals.push(...defaultGoals);
  }

  // Prioritize and filter
  const prioritized = prioritizeGoals(
    goals,
    aiState,
    deps.priorityManager,
    minPriority,
    0.1, // Small softmax tau for exploration
  );

  return prioritized.slice(0, 5); // Return top 5 goals
}

/**
 * Evaluates critical survival needs
 */
function evaluateCriticalNeeds(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  needs: EntityNeedsData,
  now: number,
): AIGoal[] {
  const goals: AIGoal[] = [];

  // Thirst (highest priority)
  if (needs.thirst < 40) {
    const waterGoal = createNeedGoal(
      "thirst",
      "water",
      needs.thirst,
      aiState,
      deps,
      now,
      130,
    );
    if (waterGoal) goals.push(waterGoal);
  }

  // Hunger
  if (needs.hunger < 45) {
    const foodGoal = createNeedGoal(
      "hunger",
      "food",
      needs.hunger,
      aiState,
      deps,
      now,
      110,
    );
    if (foodGoal) goals.push(foodGoal);
  }

  // Energy (rest)
  if (needs.energy < 35) {
    const restGoal: AIGoal = {
      id: `rest_${aiState.entityId}_${now}`,
      type: "rest",
      priority: calculateNeedPriority(needs.energy, 80),
      data: {
        need: "energy",
        action: "rest",
      },
      createdAt: now,
      expiresAt: now + 20000,
    };
    goals.push(restGoal);
  }

  // Mental Health
  if (needs.mentalHealth && needs.mentalHealth < 50) {
    const socialGoal: AIGoal = {
      id: `social_${aiState.entityId}_${now}`,
      type: "social",
      priority: calculateNeedPriority(needs.mentalHealth, 70),
      data: {
        need: "mentalHealth",
      },
      createdAt: now,
      expiresAt: now + 30000,
    };
    goals.push(socialGoal);
  }

  return goals;
}

/**
 * Creates a goal for satisfying a specific need
 */
function createNeedGoal(
  needType: string,
  resourceType: string,
  needValue: number,
  aiState: AIState,
  deps: AgentGoalPlannerDeps,
  now: number,
  urgencyMultiplier: number,
): AIGoal | null {
  // Try to find nearest resource
  let target: { id: string; x: number; y: number } | null = null;

  if (deps.findNearestResource) {
    target = deps.findNearestResource(aiState.entityId, resourceType);
  }

  // If no target found, try to find a zone
  if (!target) {
    const zoneIds = getRecommendedZoneIdsForNeed(needType, deps.gameState);
    const bestZoneId = selectBestZone(
      aiState,
      zoneIds,
      resourceType,
      deps.gameState,
      (id) => getEntityPosition(id, deps.gameState),
    );

    if (bestZoneId) {
      const zone = deps.gameState.zones?.find((z) => z.id === bestZoneId);
      if (zone) {
        target = {
          id: bestZoneId,
          x: zone.bounds.x + zone.bounds.width / 2,
          y: zone.bounds.y + zone.bounds.height / 2,
        };
      }
    }
  }

  if (!target) return null;

  return {
    id: `need_${needType}_${aiState.entityId}_${now}`,
    type: "satisfy_need",
    priority: calculateNeedPriority(needValue, urgencyMultiplier),
    targetId: target.id,
    targetPosition: { x: target.x, y: target.y },
    data: {
      need: needType,
      resourceType,
    },
    createdAt: now,
    expiresAt: now + 15000,
  };
}

/**
 * Evaluates opportunity-based goals (work, exploration, etc.)
 */
function evaluateOpportunities(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  now: number,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const personality = aiState.personality;

  // Exploration goal (based on curiosity/openness)
  if (
    personality.openness > 0.5 ||
    personality.explorationType === "adventurous"
  ) {
    const unexploredZones = getUnexploredZones(aiState, deps.gameState);
    if (unexploredZones.length > 0) {
      const targetZoneId = selectBestZone(
        aiState,
        unexploredZones,
        "explore",
        deps.gameState,
        (id) => getEntityPosition(id, deps.gameState),
      );

      if (targetZoneId) {
        const zone = deps.gameState.zones?.find((z) => z.id === targetZoneId);
        if (zone) {
          goals.push({
            id: `explore_${targetZoneId}_${now}`,
            type: "explore",
            priority: 0.4 + personality.openness * 0.3,
            targetZoneId: targetZoneId,
            targetPosition: {
              x: zone.bounds.x + zone.bounds.width / 2,
              y: zone.bounds.y + zone.bounds.height / 2,
            },
            data: {
              explorationType: "discovery",
            },
            createdAt: now,
            expiresAt: now + 60000,
          });
        }
      }
    }
  }

  // Work goal (based on diligence)
  if (
    personality.conscientiousness > 0.6 ||
    personality.workEthic === "workaholic"
  ) {
    const workZones =
      deps.gameState.zones?.filter(
        (z) => z.type === "work" || z.type === "resource",
      ) || [];
    if (workZones.length > 0) {
      const targetZone =
        workZones[Math.floor(Math.random() * workZones.length)];
      goals.push({
        id: `work_${targetZone.id}_${now}`,
        type: "work",
        priority: 0.5 + personality.conscientiousness * 0.2,
        targetZoneId: targetZone.id,
        targetPosition: {
          x: targetZone.bounds.x + targetZone.bounds.width / 2,
          y: targetZone.bounds.y + targetZone.bounds.height / 2,
        },
        data: {
          workType: "gather",
        },
        createdAt: now,
        expiresAt: now + 45000,
      });
    }
  }

  return goals;
}

/**
 * Creates default exploration goals when no other goals apply
 */
function createDefaultExplorationGoals(
  aiState: AIState,
  gameState: GameState,
  now: number,
): AIGoal[] {
  const unexploredZones = getUnexploredZones(aiState, gameState);

  if (unexploredZones.length > 0) {
    const targetZoneId = selectBestZone(
      aiState,
      unexploredZones,
      "explore",
      gameState,
      (id) => getEntityPosition(id, gameState),
    );

    if (targetZoneId) {
      const zone = gameState.zones?.find((z) => z.id === targetZoneId);
      if (zone) {
        return [
          {
            id: `default_explore_${targetZoneId}_${now}`,
            type: "explore",
            priority: 0.25,
            targetZoneId: targetZoneId,
            targetPosition: {
              x: zone.bounds.x + zone.bounds.width / 2,
              y: zone.bounds.y + zone.bounds.height / 2,
            },
            data: {
              explorationType: "default",
            },
            createdAt: now,
            expiresAt: now + 60000,
          },
        ];
      }
    }
  }

  // If no unexplored zones, wander
  return [
    {
      id: `wander_${aiState.entityId}_${now}`,
      type: "explore",
      priority: 0.1,
      data: {
        explorationType: "wander",
      },
      createdAt: now,
      expiresAt: now + 30000,
    },
  ];
}
