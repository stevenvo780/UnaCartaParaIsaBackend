import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { GameState } from "../../../types/game-types";
import type { Inventory } from "../../../types/simulation/economy";

export interface ExpansionContext {
  gameState: GameState;
  getAgentInventory: (id: string) => Inventory | undefined;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
}

export function evaluateExpansionGoals(
  ctx: ExpansionContext,
  aiState: AIState,
): AIGoal[] {
  const now = Date.now();
  const goals: AIGoal[] = [];
  const inv = ctx.getAgentInventory(aiState.entityId);

  // 1. Resource Gathering Drive
  // If inventory is not full, try to gather resources even if not strictly needed immediately
  // This simulates "stockpiling" behavior
  if (inv) {
    const totalItems = (inv.wood || 0) + (inv.stone || 0) + (inv.food || 0);
    const capacity = 50; // Default capacity assumption

    if (totalItems < capacity * 0.8) {
      // 80% capacity trigger
      // Encourages gathering wood and stone for future building
      goals.push({
        id: `gather_expansion_${now}`,
        type: "explore",
        priority: 0.35 + aiState.personality.diligence * 0.2,
        data: {
          explorationType: "resource_scout",
          targetResource: "wood", // Default to wood as it's primary building material
        },
        createdAt: now,
        expiresAt: now + 10000,
      });
    }
  }

  // 2. Expansion Scouting
  // If population is high but housing is low (heuristic), scout for new areas
  // For now, we just add a low-priority "scout" goal that encourages moving to edges
  const mapWidth = ctx.gameState.worldSize?.width || 2000;
  const mapHeight = ctx.gameState.worldSize?.height || 2000;
  const pos = ctx.getEntityPosition(aiState.entityId);

  if (pos) {
    // Encourage moving away from center if crowded?
    // Or just random expansion
    goals.push({
      id: `expand_territory_${now}`,
      type: "explore",
      priority: 0.3 + aiState.personality.curiosity * 0.3,
      data: {
        explorationType: "territory_expansion",
        targetRegionX: Math.random() * mapWidth,
        targetRegionY: Math.random() * mapHeight,
      },
      createdAt: now,
      expiresAt: now + 15000,
    });
  }

  return goals;
}
