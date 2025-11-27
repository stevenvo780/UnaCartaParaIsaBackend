import { logger } from "../../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { GameState } from "../../../../types/game-types";
import { GoalType } from "../../../../../shared/constants/AIEnums";

export interface DepositContext {
  gameState: GameState;
  getAgentInventory: (id: string) =>
    | {
        wood: number;
        stone: number;
        food: number;
        water: number;
        capacity?: number;
      }
    | undefined;
  getCurrentZone: (id: string) => string | undefined;
  selectBestZone: (
    aiState: AIState,
    zoneIds: string[],
    zoneType: string,
  ) => string | null;
}

/**
 * Evaluates deposit goals based on inventory capacity and agent personality.
 *
 * Generates deposit goals when agent inventory exceeds threshold (30% by default,
 * adjusted by conscientiousness). Prioritizes storage zones but falls back to
 * other zone types if no storage zones exist.
 *
 * @param ctx - Deposit evaluation context with game state and helper functions
 * @param aiState - Current AI state for the agent
 * @returns Array of deposit goals (empty if no deposit needed)
 */
export function evaluateDepositGoals(
  ctx: DepositContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const agentInv = ctx.getAgentInventory(aiState.entityId);
    if (!agentInv) {
      logger.debug(`📦 [DEPOSIT] ${aiState.entityId}: No inventory found`);
      return [];
    }

    const load =
      agentInv.wood + agentInv.stone + agentInv.food + agentInv.water;
    const cap = agentInv.capacity || 50;
    const loadRatio = load / cap;

    const baseThreshold = 0.3;
    const depositThreshold =
      baseThreshold - personality.conscientiousness * 0.1;

    if (loadRatio >= depositThreshold) {
      const currentZoneId = ctx.getCurrentZone(aiState.entityId);
      if (currentZoneId) {
        logger.debug(
          `🔄 Auto-deposit suggested (${(loadRatio * 100).toFixed(0)}% capacity)`,
          {
            entityId: aiState.entityId,
            load,
            capacity: cap,
            loadRatio: loadRatio.toFixed(2),
            zoneId: currentZoneId,
          },
        );
      }
    }

    if (load <= 0 || loadRatio < depositThreshold * 0.75) return [];

    const storageZones =
      ctx.gameState.zones
        ?.filter((z) => z.type === "storage")
        .map((z) => z.id) || [];

    const depositZones =
      storageZones.length > 0
        ? storageZones
        : ctx.gameState.zones
            ?.filter((z) => {
              if (z.type === "rest") return true;
              if (z.type === "food" && agentInv.food > 0) return true;
              if (z.type === "water" && agentInv.water > 0) return true;
              if (z.type === "work") return true;
              return false;
            })
            .map((z) => z.id) || [];

    if (depositZones.length === 0) return [];

    const bestZone = ctx.selectBestZone(aiState, depositZones, "storage");
    if (!bestZone) return [];

    const priorityBoost =
      loadRatio >= depositThreshold ? 0.35 : Math.min(0.3, loadRatio);

    return [
      {
        id: `deposit_${now}`,
        type: GoalType.DEPOSIT,
        priority: 0.65 + priorityBoost,
        targetZoneId: bestZone,
        data: {
          workType: "deposit",
        },
        createdAt: now,
        expiresAt: now + 4000,
      },
    ];
  } catch (error) {
    logger.error("Failed to generate deposit goals", {
      entityId: aiState.entityId,
      error,
    });
    return [];
  }
}
