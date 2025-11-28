import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import {
  GoalType,
  ExplorationType,
  GoalReason,
} from "../../../../../shared/constants/AIEnums";

import type { Inventory } from "../../../../types/simulation/economy";

export interface ReproductionDriveDeps {
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  getEntityStats?: (entityId: string) => Record<string, number> | null;
  getAgentInventory?: (entityId: string) => Inventory | undefined;
  findPotentialMate?: (
    entityId: string,
  ) => { id: string; x: number; y: number } | null;
}

/**
 * Calculates the reproduction drive based on overall well-being.
 * High drive means the agent is healthy, well-fed, and rested.
 */
function calculateReproductionDrive(
  needs: EntityNeedsData,
  stats: Record<string, number> | null,
): number {
  const health = stats?.health ?? 100;
  const energy = needs.energy;
  const hunger = needs.hunger;
  const thirst = needs.thirst;

  const wHealth = 0.3;
  const wEnergy = 0.3;
  const wFood = 0.2;
  const wWater = 0.2;

  const drive =
    (health / 100) * wHealth +
    (energy / 100) * wEnergy +
    (hunger / 100) * wFood +
    (thirst / 100) * wWater;

  if (drive < 0.8) return 0;

  return (drive - 0.8) * 5;
}

export function evaluateReproductionDrive(
  deps: ReproductionDriveDeps,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const needs = deps.getEntityNeeds(aiState.entityId);
  const stats = deps.getEntityStats?.(aiState.entityId) ?? null;

  if (!needs) return goals;

  const reproductionUtility = calculateReproductionDrive(needs, stats);

  if (reproductionUtility > 0) {
    const now = Date.now();

    const mate = deps.findPotentialMate?.(aiState.entityId);

    if (mate) {
      goals.push({
        id: `drive_reproduction_${aiState.entityId}_${now} `,
        type: GoalType.SOCIAL,
        priority: reproductionUtility,
        targetId: mate.id,
        targetPosition: { x: mate.x, y: mate.y },
        data: {
          action: "find_mate",
          reason: GoalReason.REPRODUCTION_DRIVE,
        },
        createdAt: now,
        expiresAt: now + 30000,
      });
    } else {
      goals.push({
        id: `drive_reproduction_search_${aiState.entityId}_${now} `,
        type: GoalType.EXPLORE,
        priority: reproductionUtility * 0.8,
        data: {
          explorationType: ExplorationType.SOCIAL_SEARCH,
          searchFor: "mate",
          reason: GoalReason.REPRODUCTION_DRIVE,
        },
        createdAt: now,
        expiresAt: now + 20000,
      });
    }
  }

  return goals;
}
