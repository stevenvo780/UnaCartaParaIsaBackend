import { logger } from "../../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import { GoalType } from "../../../../../shared/constants/AIEnums";

export interface CraftingContext {
  getEquipped: (id: string) => string;
  getSuggestedCraftZone: () => string | undefined;
  canCraftWeapon: (id: string, weaponId: string) => boolean;
  /** Returns true if the shared tool storage has weapons available */
  hasAvailableWeapons?: () => boolean;
  /** Returns the agent's role for priority calculation */
  getAgentRole?: (id: string) => { roleType: string } | undefined;
}

/**
 * Evaluates whether an agent should craft a weapon.
 * 
 * An agent will craft when:
 * 1. They don't have a weapon equipped
 * 2. There are no weapons in shared storage (so they need to make one)
 * 3. They have the materials to craft
 * 4. There's a crafting zone available
 * 
 * Priority varies:
 * - 0.92 for hunters/guards (they CANNOT do their job without weapons, critical priority)
 * - 0.55 for others (nice to have for defense)
 * 
 * Hunters without weapons should prioritize crafting over most other tasks
 * since they're useless at hunting without a weapon.
 */
export function evaluateCrafting(
  ctx: CraftingContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const now = Date.now();

    // Only craft if unarmed
    const equipped = ctx.getEquipped(aiState.entityId) || "unarmed";
    if (equipped !== "unarmed") return [];

    // Check if shared storage already has weapons - if so, agent can claim one instead of crafting
    if (ctx.hasAvailableWeapons?.()) {
      logger.debug(
        `🔨 [Crafting] ${aiState.entityId}: Weapons available in storage, skipping craft`,
      );
      return [];
    }

    const canClub = ctx.canCraftWeapon(aiState.entityId, "wooden_club");
    const canDagger = ctx.canCraftWeapon(aiState.entityId, "stone_dagger");

    if (!canClub && !canDagger) {
      logger.debug(
        `🔨 [Crafting] ${aiState.entityId}: Cannot craft (canClub=${canClub}, canDagger=${canDagger})`,
      );
      return [];
    }

    const targetZone = ctx.getSuggestedCraftZone();
    if (!targetZone) return [];

    // Determine which weapon to craft (prefer dagger as it's stronger)
    const weaponToCraft = canDagger ? "stone_dagger" : "wooden_club";

    // Higher priority for hunters/guards who NEED weapons for their job
    // Hunters without weapons are useless - give them high priority to craft
    const role = ctx.getAgentRole?.(aiState.entityId);
    const roleType = role?.roleType?.toLowerCase() ?? "";
    const needsWeaponForJob =
      roleType === "hunter" || roleType === "guard" || roleType === "warrior";
    // 0.92 for combat roles (high enough to compete with water 0.88)
    // 0.72 for others (above deposit ~0.65-0.70, so agents will craft before depositing)
    const priority = needsWeaponForJob ? 0.92 : 0.72;

    logger.info(
      `🔨 [Crafting] ${aiState.entityId}: Creating craft goal for ${weaponToCraft} (priority=${priority.toFixed(2)}, role=${roleType}, needsWeapon=${needsWeaponForJob})`,
    );

    return [
      {
        id: `craft_weapon_${now}`,
        type: GoalType.CRAFT,
        priority,
        targetZoneId: targetZone,
        data: {
          itemType: "weapon",
          itemId: weaponToCraft,
          roleNeedsWeapon: needsWeaponForJob, // Pass this for tier calculation
        },
        createdAt: now,
        expiresAt: now + 10000, // 10 seconds to complete
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
