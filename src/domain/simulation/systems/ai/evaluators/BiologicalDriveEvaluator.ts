import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import { GoalType, NeedType } from "../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";
import type { Inventory } from "../../../../types/simulation/economy";

export interface BiologicalDriveDeps {
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  getAgentInventory?: (entityId: string) => Inventory | undefined;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  findNearestHuntableAnimal?: (
    entityId: string,
  ) => { id: string; x: number; y: number; type: string } | null;
  findAgentWithResource?: (
    entityId: string,
    resourceType: "food" | "water",
    minAmount: number,
  ) => { agentId: string; x: number; y: number } | null;
}

/**
 * Calculates utility for a biological drive.
 * Returns a value between 0.0 and 1.0.
 * @param value Current need value (0-100, where 100 is satisfied)
 * @param urgencyExponent Controls how sharply utility rises as need drops. Higher = more urgent only when very low.
 */
function calculateDriveUtility(
  value: number,
  urgencyExponent: number = 2,
): number {
  // Normalize value to 0-1 (1 is satisfied)
  const normalized = Math.max(0, Math.min(100, value)) / 100;
  // Invert: 0 is satisfied, 1 is empty
  const deficit = 1 - normalized;

  // Apply curve
  // If exponent is 2: 0.5 deficit -> 0.25 utility. 0.9 deficit -> 0.81 utility.
  // If exponent is 0.5: 0.5 deficit -> 0.7 utility. (Urgent sooner)
  // For survival needs, we want them to become urgent reasonably fast but not dominate when high.
  // Let's use a custom curve that stays low until ~50, then spikes.

  if (value > 60) return 0; // Not interested

  // Use the exponent to shape the curve for the remaining range (0-60)
  // Remap 60->0 to 0->1 deficit relative to threshold
  const relativeDeficit = (60 - value) / 60;

  // Apply exponent
  return Math.pow(relativeDeficit, 1 / urgencyExponent);
}

export function evaluateBiologicalDrives(
  deps: BiologicalDriveDeps,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const needs = deps.getEntityNeeds(aiState.entityId);

  if (!needs) return goals;

  const now = Date.now();

  // --- Thirst Drive ---
  const thirstUtility = calculateDriveUtility(needs.thirst);
  if (thirstUtility > 0) {
    const inventory = deps.getAgentInventory?.(aiState.entityId);
    const hasWater = inventory && inventory.water > 0;

    if (!hasWater) {
      // Plan to get water
      const waterTarget = deps.findNearestResource?.(
        aiState.entityId,
        "water_source",
      );

      if (waterTarget) {
        goals.push({
          id: `drive_thirst_gather_${aiState.entityId}_${now}`,
          type: GoalType.GATHER,
          priority: thirstUtility,
          targetId: waterTarget.id,
          targetPosition: { x: waterTarget.x, y: waterTarget.y },
          data: {
            need: NeedType.THIRST,
            resourceType: ResourceType.WATER,
            action: "gather",
          },
          createdAt: now,
          expiresAt: now + 15000,
        });
      } else {
        // Trade or Explore
        // ... (Simplified for brevity, can expand)
        goals.push({
          id: `drive_thirst_explore_${aiState.entityId}_${now}`,
          type: GoalType.EXPLORE,
          priority: thirstUtility * 0.8, // Lower priority than known source
          data: {
            explorationType: "desperate_search",
            need: NeedType.THIRST,
          },
          createdAt: now,
          expiresAt: now + 10000,
        });
      }
    }
  }

  // --- Hunger Drive ---
  const hungerUtility = calculateDriveUtility(needs.hunger);
  if (hungerUtility > 0) {
    const inventory = deps.getAgentInventory?.(aiState.entityId);
    const hasFood = inventory && inventory.food > 0;

    if (!hasFood) {
      // 1. Check for gatherable food
      const foodTypes = ["wheat_crop", "berry_bush", "mushroom_patch"];
      let foodTarget = null;

      if (deps.findNearestResource) {
        for (const type of foodTypes) {
          const target = deps.findNearestResource(aiState.entityId, type);
          if (target) {
            foodTarget = target;
            break;
          }
        }
      }

      if (foodTarget) {
        goals.push({
          id: `drive_hunger_gather_${aiState.entityId}_${now}`,
          type: GoalType.GATHER,
          priority: hungerUtility,
          targetId: foodTarget.id,
          targetPosition: { x: foodTarget.x, y: foodTarget.y },
          data: {
            need: NeedType.HUNGER,
            resourceType: ResourceType.FOOD,
            action: "gather",
          },
          createdAt: now,
          expiresAt: now + 15000,
        });
      } else {
        // 2. Hunt
        const huntTarget = deps.findNearestHuntableAnimal?.(aiState.entityId);
        if (huntTarget) {
          goals.push({
            id: `drive_hunger_hunt_${aiState.entityId}_${now}`,
            type: GoalType.HUNT,
            priority: hungerUtility, // Hunting is as good as gathering if hungry
            targetId: huntTarget.id,
            targetPosition: { x: huntTarget.x, y: huntTarget.y },
            data: {
              need: NeedType.HUNGER,
              animalType: huntTarget.type,
              action: "hunt",
            },
            createdAt: now,
            expiresAt: now + 20000,
          });
        } else {
          // 3. Explore
          goals.push({
            id: `drive_hunger_explore_${aiState.entityId}_${now}`,
            type: GoalType.EXPLORE,
            priority: hungerUtility * 0.9,
            data: {
              explorationType: "desperate_search",
              need: NeedType.HUNGER,
              searchFor: "food_or_prey",
            },
            createdAt: now,
            expiresAt: now + 10000,
          });
        }
      }
    }
  }

  // --- Energy Drive ---
  const energyUtility = calculateDriveUtility(needs.energy);
  if (energyUtility > 0) {
    goals.push({
      id: `drive_energy_rest_${aiState.entityId}_${now}`,
      type: GoalType.SATISFY_ENERGY, // Or GoalType.REST if available
      priority: energyUtility,
      data: {
        need: NeedType.ENERGY,
        action: "rest",
      },
      createdAt: now,
      expiresAt: now + 20000,
    });
  }

  return goals;
}
