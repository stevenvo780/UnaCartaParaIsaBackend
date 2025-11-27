import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import { GoalType } from "../../../../../shared/constants/AIEnums";

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
  const health = stats?.health ?? 100; // Default to 100 if unknown
  const energy = needs.energy;
  const hunger = needs.hunger; // 100 is full
  const thirst = needs.thirst; // 100 is hydrated

  // Weights
  const wHealth = 0.3;
  const wEnergy = 0.3;
  const wFood = 0.2;
  const wWater = 0.2;

  const drive =
    (health / 100) * wHealth +
    (energy / 100) * wEnergy +
    (hunger / 100) * wFood +
    (thirst / 100) * wWater;

  // Only trigger if drive is very high (agents should prioritize survival/work unless thriving)
  if (drive < 0.8) return 0;

  // Remap 0.8-1.0 to 0.0-1.0 utility
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

    // Find a mate
    // We assume findPotentialMate is implemented or we use a generic social search
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
          reason: "reproduction_drive",
        },
        createdAt: now,
        expiresAt: now + 30000,
      });
    } else {
      // Search for mate (social explore)
      goals.push({
        id: `drive_reproduction_search_${aiState.entityId}_${now} `,
        type: GoalType.EXPLORE, // Or SOCIAL if supported without target
        priority: reproductionUtility * 0.8,
        data: {
          explorationType: "social_search",
          searchFor: "mate",
          reason: "reproduction_drive",
        },
        createdAt: now,
        expiresAt: now + 20000,
      });
    }
  }

  return goals;
}
