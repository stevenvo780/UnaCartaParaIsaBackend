import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import { GoalType, NeedType } from "../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";
import type { Inventory } from "../../../../types/simulation/economy";
import { logger } from "@/infrastructure/utils/logger";

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
  getAgentPosition?: (entityId: string) => { x: number; y: number } | null;
  getFailedTargets?: (entityId: string) => Map<string, number> | undefined;
}

/** Max distance for priority adjustment (beyond this, no bonus) */
const MAX_PRIORITY_DISTANCE = 600;
/** Cooldown for failed targets in ms */
const FAILED_TARGET_COOLDOWN_MS = 30000;

/**
 * Adjusts priority based on distance - closer targets get higher priority.
 * Returns multiplier between 0.6 and 1.0
 */
function distancePriorityMultiplier(
  agentPos: { x: number; y: number } | null,
  targetPos: { x: number; y: number },
): number {
  if (!agentPos) return 1.0;
  const dist = Math.hypot(targetPos.x - agentPos.x, targetPos.y - agentPos.y);
  // Closer = higher multiplier (1.0), farther = lower (0.6 minimum)
  return Math.max(0.6, 1.0 - (dist / MAX_PRIORITY_DISTANCE) * 0.4);
}

/**
 * Checks if a target is on cooldown from a previous failure.
 */
function isTargetOnCooldown(
  failedTargets: Map<string, number> | undefined,
  targetId: string,
  now: number,
): boolean {
  if (!failedTargets) return false;
  const failedAt = failedTargets.get(targetId);
  if (!failedAt) return false;
  return now - failedAt < FAILED_TARGET_COOLDOWN_MS;
}

/**
 * Threshold for when biological needs become urgent enough to interrupt work.
 * Aligned with prePlanGoals threshold (40) so agents work when needs >= 40.
 */
const BIOLOGICAL_URGENCY_THRESHOLD = 40;

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
  // For survival needs, we want them to become urgent reasonably fast but not dominate when high.
  // When needs >= 40, agents should work. Below 40, biological needs take priority.
  if (value >= BIOLOGICAL_URGENCY_THRESHOLD) return 0; // Needs satisfied, allow work

  // Use the exponent to shape the curve for the remaining range (0-40)
  // Remap 40->0 to 0->1 deficit relative to threshold
  const relativeDeficit =
    (BIOLOGICAL_URGENCY_THRESHOLD - value) / BIOLOGICAL_URGENCY_THRESHOLD;

  // Apply exponent: higher exponent = more urgent only when very low
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
  const agentPos = deps.getAgentPosition?.(aiState.entityId) ?? null;
  const failedTargets = deps.getFailedTargets?.(aiState.entityId);

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

      // Debug: Log water search result
      if (!waterTarget) {
        logger.warn(
          `[BIO] ${aiState.entityId}: thirst=${needs.thirst.toFixed(1)}, no water_source found`,
        );
      } else {
        logger.debug(
          `[BIO] ${aiState.entityId}: found water_source ${waterTarget.id} at (${waterTarget.x}, ${waterTarget.y})`,
        );
      }

      if (
        waterTarget &&
        !isTargetOnCooldown(failedTargets, waterTarget.id, now)
      ) {
        const distMult = distancePriorityMultiplier(agentPos, waterTarget);
        goals.push({
          id: `drive_thirst_gather_${aiState.entityId}_${now}`,
          type: GoalType.GATHER,
          priority: thirstUtility * distMult,
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
      }
      // NOTE: If no water_source is found, don't add explore goal
      // This allows agents to work instead of endlessly searching for water
    }
  }

  // --- Hunger Drive ---
  const hungerUtility = calculateDriveUtility(needs.hunger);
  if (hungerUtility > 0) {
    const inventory = deps.getAgentInventory?.(aiState.entityId);
    const hasFood = inventory && inventory.food > 0;

    if (!hasFood) {
      // 1. Try to hunt first (more reliable than sparse berry bushes)
      const huntTarget = deps.findNearestHuntableAnimal?.(aiState.entityId);
      if (
        huntTarget &&
        !isTargetOnCooldown(failedTargets, huntTarget.id, now)
      ) {
        const distMult = distancePriorityMultiplier(agentPos, huntTarget);
        goals.push({
          id: `drive_hunger_hunt_${aiState.entityId}_${now}`,
          type: GoalType.HUNT,
          priority: hungerUtility * distMult,
          targetId: huntTarget.id,
          targetPosition: { x: huntTarget.x, y: huntTarget.y },
          data: {
            need: NeedType.HUNGER,
            animalType: huntTarget.type,
            action: "hunt",
          },
          createdAt: now,
          expiresAt: now + 60000, // 60 seconds to complete hunt
        });
      } else {
        // 2. If no animals, check for gatherable food
        const foodTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];
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

        if (
          foodTarget &&
          !isTargetOnCooldown(failedTargets, foodTarget.id, now)
        ) {
          const distMult = distancePriorityMultiplier(agentPos, foodTarget);
          goals.push({
            id: `drive_hunger_gather_${aiState.entityId}_${now}`,
            type: GoalType.GATHER,
            priority: hungerUtility * 0.9 * distMult, // Slightly lower than hunting
            targetId: foodTarget.id,
            targetPosition: { x: foodTarget.x, y: foodTarget.y },
            data: {
              need: NeedType.HUNGER,
              resourceType: ResourceType.FOOD,
              action: "gather",
            },
            createdAt: now,
            expiresAt: now + 45000, // 45 seconds to reach and harvest
          });
        } else {
          // 3. Explore to find food
          goals.push({
            id: `drive_hunger_explore_${aiState.entityId}_${now}`,
            type: GoalType.EXPLORE,
            priority: hungerUtility * 0.7,
            data: {
              explorationType: "desperate_search",
              need: NeedType.HUNGER,
              searchFor: "food_or_prey",
            },
            createdAt: now,
            expiresAt: now + 30000,
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
