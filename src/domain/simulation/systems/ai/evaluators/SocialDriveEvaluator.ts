import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import { GoalType, NeedType } from "../../../../../shared/constants/AIEnums";

export interface SocialDriveDeps {
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  findNearbyAgent?: (
    entityId: string,
  ) => { id: string; x: number; y: number } | null;
}

function calculateDriveUtility(value: number): number {
  if (value > 70) return 0;
  return Math.min(1.0, (70 - value) / 70);
}

export function evaluateSocialDrives(
  deps: SocialDriveDeps,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const needs = deps.getEntityNeeds(aiState.entityId);

  if (!needs) return goals;

  const now = Date.now();

  const socialUtility = calculateDriveUtility(needs.social);
  if (socialUtility > 0) {
    goals.push({
      id: `drive_social_${aiState.entityId}_${now}`,
      type: GoalType.SATISFY_SOCIAL,
      priority: socialUtility * 0.8,
      data: {
        need: NeedType.SOCIAL,
        action: "socialize",
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  const funUtility = calculateDriveUtility(needs.fun);
  if (funUtility > 0) {
    goals.push({
      id: `drive_fun_${aiState.entityId}_${now}`,
      type: GoalType.SATISFY_FUN,
      priority: funUtility * 0.7,
      data: {
        need: NeedType.FUN,
        action: "play",
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  const mentalUtility = calculateDriveUtility(needs.mentalHealth);
  if (mentalUtility > 0) {
    goals.push({
      id: `drive_mental_${aiState.entityId}_${now}`,
      type: GoalType.SATISFY_SOCIAL,
      priority: mentalUtility * 0.9,
      data: {
        need: NeedType.MENTAL_HEALTH,
        action: "meditate",
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  return goals;
}
