import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { AgentRole } from "../../../types/simulation/roles";

export interface OpportunitiesEvaluatorDependencies {
  getAgentRole: (agentId: string) => AgentRole | undefined;
  getPreferredResourceForRole: (roleType: string) => string | null;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
}

export function evaluateWorkOpportunities(
  deps: OpportunitiesEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

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

export function evaluateExplorationGoals(aiState: AIState): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

  if (aiState.personality.curiosity > 0.5) {
    goals.push({
      id: `explore_${aiState.entityId}_${now}`,
      type: "explore",
      priority: 0.3 * aiState.personality.curiosity,
      data: {
        reason: "curiosity",
      },
      createdAt: now,
      expiresAt: now + 60000,
    });
  }

  return goals;
}
