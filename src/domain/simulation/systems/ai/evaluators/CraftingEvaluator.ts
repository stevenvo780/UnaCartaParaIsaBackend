import { logger } from "../../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import { GoalType } from "../../../../../shared/constants/AIEnums";

export interface CraftingContext {
  getEquipped: (id: string) => string;
  getSuggestedCraftZone: () => string | undefined;
  canCraftWeapon: (id: string, weaponId: string) => boolean;
}

export function evaluateCrafting(
  ctx: CraftingContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const equipped = ctx.getEquipped(aiState.entityId) || "unarmed";
    if (equipped !== "unarmed") return [];

    const canClub = ctx.canCraftWeapon(aiState.entityId, "wooden_club");
    const canDagger = ctx.canCraftWeapon(aiState.entityId, "stone_dagger");

    if (!canClub && !canDagger) return [];

    const targetZone = ctx.getSuggestedCraftZone();
    if (!targetZone) return [];

    const craftChance =
      personality.openness * 0.2 + personality.neuroticism * 0.1;

    const shouldCraft = Math.random() < craftChance;
    if (!shouldCraft) return [];

    return [
      {
        id: `craft_weapon_${now}`,
        type: GoalType.CRAFT,
        priority: 0.6,
        targetZoneId: targetZone,
        data: {
          itemType: "weapon",
          itemId: canClub ? "wooden_club" : "stone_dagger",
        },
        createdAt: now,
        expiresAt: now + 3000,
      },
    ];
  } catch (error) {
    logger.error("Failed to evaluate crafting opportunity", {
      entityId: aiState.entityId,
      error,
    });
    return [];
  }
}
