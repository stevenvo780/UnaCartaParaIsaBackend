import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { GameState } from "../../../../types/game-types";
import type { Inventory } from "../../../../types/simulation/economy";
import { RandomUtils } from "../../../../../shared/utils/RandomUtils";
import { GoalType } from "../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";

export interface ExpansionContext {
  gameState: GameState;
  getAgentInventory: (id: string) => Inventory | undefined;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
}

const DEFAULT_INVENTORY_CAPACITY = 50;
const GATHER_TRIGGER_THRESHOLD = 0.8;
const GATHER_GOAL_DURATION_MS = 10000;
const EXPANSION_GOAL_DURATION_MS = 15000;

export function evaluateExpansionGoals(
  ctx: ExpansionContext,
  aiState: AIState,
  now: number,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const inv = ctx.getAgentInventory(aiState.entityId);

  /**
   * Resource Gathering Drive: If inventory is not full, try to gather resources
   * even if not strictly needed immediately. This simulates "stockpiling" behavior.
   */
  if (inv) {
    const totalItems = (inv.wood || 0) + (inv.stone || 0) + (inv.food || 0);
    const capacity = DEFAULT_INVENTORY_CAPACITY;

    if (totalItems < capacity * GATHER_TRIGGER_THRESHOLD) {
      goals.push({
        id: `gather_expansion_${now}`,
        type: GoalType.EXPLORE,
        priority: 0.35 + aiState.personality.diligence * 0.2,
        data: {
          explorationType: "resource_scout",
          targetResource: ResourceType.WOOD, // Default to wood as it's primary building material
        },
        createdAt: now,
        expiresAt: now + GATHER_GOAL_DURATION_MS,
      });
    }
  }

  /**
   * Expansion Scouting: If population is high but housing is low (heuristic),
   * scout for new areas. Adds a low-priority "scout" goal that encourages moving to edges.
   */
  const mapWidth = ctx.gameState.worldSize?.width || 2000;
  const mapHeight = ctx.gameState.worldSize?.height || 2000;
  const pos = ctx.getEntityPosition(aiState.entityId);

  if (pos) {
    goals.push({
      id: `expand_territory_${now}`,
      type: GoalType.EXPLORE,
      priority: 0.3 + aiState.personality.curiosity * 0.3,
      data: {
        explorationType: "territory_expansion",
        targetRegionX: RandomUtils.floatRange(0, mapWidth),
        targetRegionY: RandomUtils.floatRange(0, mapHeight),
      },
      createdAt: now,
      expiresAt: now + EXPANSION_GOAL_DURATION_MS,
    });
  }

  return goals;
}
