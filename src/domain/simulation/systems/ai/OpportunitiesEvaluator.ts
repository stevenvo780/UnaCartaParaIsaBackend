import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { AgentRole } from "../../../types/simulation/roles";
import type { GameState } from "../../../types/game-types";

export interface OpportunitiesEvaluatorDependencies {
  getAgentRole: (agentId: string) => AgentRole | undefined;
  getPreferredResourceForRole: (roleType: string) => string | null;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  getCurrentTimeOfDay?: () => "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night" | "deep_night";
}

export interface ExplorationDependencies {
  gameState: GameState;
  getUnexploredZones: (aiState: AIState, gameState: GameState) => string[];
  selectBestZone: (
    aiState: AIState,
    zoneIds: string[],
    zoneType: string,
    gameState: GameState,
    getPosition: (id: string) => { x: number; y: number } | null,
  ) => string | null;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
}

export function evaluateWorkOpportunities(
  deps: OpportunitiesEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();
  const timeOfDay = deps.getCurrentTimeOfDay?.() || "midday";

  // Reduce work priority at night
  if (timeOfDay === "night" || timeOfDay === "deep_night") {
    return goals; // Don't work at night
  }

  const role = deps.getAgentRole(aiState.entityId);

  if (!role) {
    return goals;
  }

  const preferredResource = deps.getPreferredResourceForRole(role.roleType);

  if (!preferredResource || !deps.findNearestResource) {
    goals.push({
      id: `work_${aiState.entityId}_${now}`,
      type: "work",
      priority: 0.6 * aiState.personality.diligence,
      data: {
        roleType: role.roleType,
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
    return goals;
  }

  const resourceTarget = deps.findNearestResource(
    aiState.entityId,
    preferredResource,
  );

  if (resourceTarget) {
    goals.push({
      id: `work_${aiState.entityId}_${now}`,
      type: "work",
      priority: 0.7 * aiState.personality.diligence * role.efficiency,
      targetId: resourceTarget.id,
      targetPosition: { x: resourceTarget.x, y: resourceTarget.y },
      data: {
        roleType: role.roleType,
        resourceType: preferredResource,
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  return goals;
}

export function evaluateExplorationOpportunities(
  deps: ExplorationDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();
  const personality = aiState.personality;

  if (
    personality.openness > 0.5 ||
    personality.explorationType === "adventurous"
  ) {
    const unexploredZones = deps.getUnexploredZones(aiState, deps.gameState);
    if (unexploredZones.length > 0) {
      const targetZoneId = deps.selectBestZone(
        aiState,
        unexploredZones,
        "explore",
        deps.gameState,
        deps.getEntityPosition,
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
