import type { GameState } from "../../../types/game-types";
import type { AIGoal, AIState } from "../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { AgentRole } from "../../../types/simulation/roles";
import type { PriorityManager } from "./PriorityManager";
import { evaluateCriticalNeeds } from "./NeedsEvaluator";
import { evaluateWorkOpportunities } from "./OpportunitiesEvaluator";
import {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
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
  getAgentRole?: (agentId: string) => AgentRole | undefined;
  getPreferredResourceForRole?: (roleType: string) => string | undefined;
}

export function planGoals(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  minPriority: number = 0.3,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);

  if (!entityNeeds) {
    return createDefaultExplorationGoals(aiState, deps.gameState, now);
  }

  const needsDeps = {
    getEntityNeeds: deps.getEntityNeeds,
    findNearestResource: deps.findNearestResource,
  };
  const criticalGoals = evaluateCriticalNeeds(needsDeps, aiState);
  goals.push(...criticalGoals);

  if (criticalGoals.length === 0 || criticalGoals[0].priority < 0.7) {
    if (deps.getAgentRole && deps.getPreferredResourceForRole) {
      const oppDeps = {
        getAgentRole: deps.getAgentRole,
        getPreferredResourceForRole: (role: string) =>
          deps.getPreferredResourceForRole!(role) || null,
        findNearestResource: deps.findNearestResource,
      };
      const workGoals = evaluateWorkOpportunities(oppDeps, aiState);
      goals.push(...workGoals);
    }

    const opportunityGoals = evaluateOpportunities(deps, aiState, now);
    goals.push(...opportunityGoals);
  }

  if (goals.length === 0) {
    const defaultGoals = createDefaultExplorationGoals(
      aiState,
      deps.gameState,
      now,
    );
    goals.push(...defaultGoals);
  }

  const prioritized = prioritizeGoals(
    goals,
    aiState,
    deps.priorityManager,
    minPriority,
    0.1,
  );

  return prioritized.slice(0, 5);
}

function evaluateOpportunities(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  now: number,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const personality = aiState.personality;

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

  return goals;
}

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
