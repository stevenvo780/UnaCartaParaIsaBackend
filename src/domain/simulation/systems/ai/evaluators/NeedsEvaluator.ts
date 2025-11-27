import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import type { RoleType } from "../../../../types/simulation/roles";
import type { Inventory } from "../../../../types/simulation/economy";

/**
 * Role-based threshold modifiers for individual needs.
 * Each role has different tolerances based on their work type.
 */
interface RoleNeedModifiers {
  hunger: number;
  thirst: number;
  energy: number;
  social: number;
}

const ROLE_NEED_MODIFIERS: Record<RoleType, RoleNeedModifiers> = {
  logger: { hunger: 0.9, thirst: 0.95, energy: 0.85, social: 1.0 },
  quarryman: { hunger: 0.9, thirst: 0.9, energy: 0.8, social: 1.0 },
  builder: { hunger: 0.95, thirst: 0.95, energy: 0.85, social: 1.1 },
  farmer: { hunger: 0.85, thirst: 0.9, energy: 0.9, social: 0.95 },
  gatherer: { hunger: 0.9, thirst: 0.85, energy: 0.95, social: 0.9 },
  guard: { hunger: 1.1, thirst: 1.1, energy: 1.2, social: 0.8 },
  hunter: { hunger: 0.85, thirst: 0.95, energy: 1.1, social: 0.85 },
  craftsman: { hunger: 0.95, thirst: 0.95, energy: 0.9, social: 1.0 },
  leader: { hunger: 1.0, thirst: 1.0, energy: 1.0, social: 1.2 },
  idle: { hunger: 1.0, thirst: 1.0, energy: 1.0, social: 1.0 },
};

export interface NeedsEvaluatorDependencies {
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  /** Get agent's inventory to check if they have resources */
  getAgentInventory?: (entityId: string) => Inventory | undefined;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  /** Find agents who have excess resources to trade */
  findAgentWithResource?: (
    entityId: string,
    resourceType: "food" | "water",
    minAmount: number,
  ) => { agentId: string; x: number; y: number } | null;
  getCurrentTimeOfDay?: () =>
    | "dawn"
    | "morning"
    | "midday"
    | "afternoon"
    | "dusk"
    | "night"
    | "deep_night";
  /** Agent's current role for threshold adjustment */
  getAgentRole?: (entityId: string) => { roleType: RoleType } | undefined;
  /** Community resource state for collective need awareness */
  getCollectiveResourceState?: () => {
    foodPerCapita: number;
    waterPerCapita: number;
    stockpileFillRatio: number;
  } | null;
}

export function calculateNeedPriority(
  currentValue: number,
  urgencyMultiplier: number = 100,
): number {
  if (currentValue >= 80) return 0;
  if (currentValue >= 60) return 0.2;
  if (currentValue >= 40) return 0.5;
  if (currentValue >= 20) return 0.8;
  return 1.0 * (urgencyMultiplier / 100);
}

/**
 * Adjusts a need threshold based on role, time of day, and community state.
 * Lower modifier = agent waits longer before satisfying the need (more tolerant)
 * Higher modifier = agent acts sooner (less tolerant)
 */
function adjustThreshold(
  baseThreshold: number,
  needType: keyof RoleNeedModifiers,
  roleType: RoleType,
  communityState: {
    foodPerCapita: number;
    waterPerCapita: number;
    stockpileFillRatio: number;
  } | null,
): number {
  let modifier = ROLE_NEED_MODIFIERS[roleType]?.[needType] ?? 1.0;

  // Community state affects individual tolerance
  if (communityState) {
    // When community is struggling, workers are more tolerant of personal needs
    if (needType === "hunger" && communityState.foodPerCapita < 5) {
      modifier *= 0.85; // More tolerant when food is scarce (help gather more)
    }
    if (needType === "thirst" && communityState.waterPerCapita < 8) {
      modifier *= 0.9;
    }
    // When stockpiles are very full, agents can be less tolerant (relax more)
    if (communityState.stockpileFillRatio > 0.8) {
      modifier *= 1.1;
    }
  }

  return Math.max(15, Math.min(70, baseThreshold * modifier));
}

export function evaluateCriticalNeeds(
  deps: NeedsEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);

  if (!entityNeeds) {
    return goals;
  }

  const needs = entityNeeds;
  const now = Date.now();
  const timeOfDay = deps.getCurrentTimeOfDay?.() || "midday";
  const role = deps.getAgentRole?.(aiState.entityId);
  const roleType = role?.roleType ?? "idle";
  const communityState = deps.getCollectiveResourceState?.() ?? null;

  // Base thresholds
  let baseHungerThreshold = 45;
  const baseThirstThreshold = 40;
  let baseEnergyThreshold = 35;

  // Time of day adjustments to base thresholds
  if (timeOfDay === "night" || timeOfDay === "deep_night") {
    baseEnergyThreshold = 50; // More critical at night
    baseHungerThreshold = 35; // Less critical at night
  } else if (timeOfDay === "morning" || timeOfDay === "dawn") {
    baseHungerThreshold = 50; // More critical in morning
    baseEnergyThreshold = 40; // Less critical after rest
  }

  // Apply role and community state adjustments
  const hungerThreshold = adjustThreshold(
    baseHungerThreshold,
    "hunger",
    roleType,
    communityState,
  );
  const thirstThreshold = adjustThreshold(
    baseThirstThreshold,
    "thirst",
    roleType,
    communityState,
  );
  const energyThreshold = adjustThreshold(
    baseEnergyThreshold,
    "energy",
    roleType,
    communityState,
  );

  if (needs.thirst < thirstThreshold) {
    // Check inventory first - if we have water, NeedsSystem will consume it automatically
    const inventory = deps.getAgentInventory?.(aiState.entityId);
    const hasWater = inventory && inventory.water > 0;

    if (hasWater) {
      // Agent has water in inventory, it will be consumed automatically
      // No goal needed - just idle or continue current task
    } else {
      // Need to acquire water - either gather or trade
      let waterTarget = null;
      if (deps.findNearestResource) {
        waterTarget = deps.findNearestResource(aiState.entityId, "water_source");
      }

      if (waterTarget) {
        // Go gather water from a source
        goals.push({
          id: `gather_water_${aiState.entityId}_${now}`,
          type: "gather",
          priority: calculateNeedPriority(needs.thirst, 130),
          targetId: waterTarget.id,
          targetPosition: { x: waterTarget.x, y: waterTarget.y },
          data: {
            need: "thirst",
            resourceType: "water",
            action: "gather",
          },
          createdAt: now,
          expiresAt: now + 15000,
        });
      } else {
        // Try to trade for water
        const tradeTarget = deps.findAgentWithResource?.(
          aiState.entityId,
          "water",
          3,
        );

        if (tradeTarget) {
          goals.push({
            id: `trade_water_${aiState.entityId}_${now}`,
            type: "work",
            priority: calculateNeedPriority(needs.thirst, 120),
            targetId: tradeTarget.agentId,
            targetPosition: { x: tradeTarget.x, y: tradeTarget.y },
            data: {
              need: "thirst",
              resourceType: "water",
              action: "trade",
            },
            createdAt: now,
            expiresAt: now + 15000,
          });
        } else {
          // Desperate search
          goals.push({
            id: `desperate_water_${aiState.entityId}_${now}`,
            type: "explore",
            priority: calculateNeedPriority(needs.thirst, 140),
            data: {
              explorationType: "desperate_search",
              need: "thirst",
            },
            createdAt: now,
            expiresAt: now + 10000,
          });
        }
      }
    }
  }

  if (needs.hunger < hungerThreshold) {
    // Check inventory first - if we have food, NeedsSystem will consume it automatically
    const inventory = deps.getAgentInventory?.(aiState.entityId);
    const hasFood = inventory && inventory.food > 0;

    if (hasFood) {
      // Agent has food in inventory, it will be consumed automatically
      // No goal needed - just idle or continue current task
    } else {
      // Need to acquire food - either gather or trade
      let foodTarget = null;
      if (deps.findNearestResource) {
        const foodTypes = ["wheat_crop", "berry_bush", "mushroom_patch", "food_zone"];
        for (const foodType of foodTypes) {
          foodTarget = deps.findNearestResource(aiState.entityId, foodType);
          if (foodTarget) break;
        }
      }

      if (foodTarget) {
        // Go gather food from a source
        goals.push({
          id: `gather_food_${aiState.entityId}_${now}`,
          type: "gather",
          priority: calculateNeedPriority(needs.hunger, 110),
          targetId: foodTarget.id,
          targetPosition: { x: foodTarget.x, y: foodTarget.y },
          data: {
            need: "hunger",
            resourceType: "food",
            action: "gather",
          },
          createdAt: now,
          expiresAt: now + 15000,
        });
      } else {
        // Try to trade for food
        const tradeTarget = deps.findAgentWithResource?.(
          aiState.entityId,
          "food",
          3,
        );

        if (tradeTarget) {
          goals.push({
            id: `trade_food_${aiState.entityId}_${now}`,
            type: "work",
            priority: calculateNeedPriority(needs.hunger, 100),
            targetId: tradeTarget.agentId,
            targetPosition: { x: tradeTarget.x, y: tradeTarget.y },
            data: {
              need: "hunger",
              resourceType: "food",
              action: "trade",
            },
            createdAt: now,
            expiresAt: now + 15000,
          });
        } else {
          // Desperate search for food or prey
          goals.push({
            id: `desperate_food_${aiState.entityId}_${now}`,
            type: "explore",
            priority: calculateNeedPriority(needs.hunger, 120),
            data: {
              explorationType: "desperate_search",
              need: "hunger",
              searchFor: "food_or_prey",
            },
            createdAt: now,
            expiresAt: now + 10000,
          });
        }
      }
    }
  }

  if (needs.energy < energyThreshold) {
    goals.push({
      id: `energy_${aiState.entityId}_${now}`,
      type: "satisfy_need",
      priority: calculateNeedPriority(needs.energy, 80),
      data: {
        need: "energy",
        action: "rest",
      },
      createdAt: now,
      expiresAt: now + 20000,
    });
  }

  if (needs.mentalHealth < 50) {
    goals.push({
      id: `social_${aiState.entityId}_${now}`,
      type: "social",
      priority: calculateNeedPriority(needs.mentalHealth, 70),
      data: {
        need: "mentalHealth",
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  return goals;
}
