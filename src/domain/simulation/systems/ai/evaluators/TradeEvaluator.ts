import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { Inventory } from "../../../../types/simulation/economy";
import { GoalType } from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";

export interface TradeEvaluatorDependencies {
  getAgentInventory: (id: string) => Inventory | undefined;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getAllActiveAgentIds: () => string[];
  gameState: {
    zones?: Array<{
      id: string;
      type: string;
      bounds: { x: number; y: number; width: number; height: number };
    }>;
  };
}

export function evaluateTradeGoals(
  deps: TradeEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

  const myInventory = deps.getAgentInventory(aiState.entityId);
  if (!myInventory) return goals;

  const excessThreshold = 20;
  const hasExcess =
    (myInventory.wood || 0) > excessThreshold ||
    (myInventory.stone || 0) > excessThreshold ||
    (myInventory.food || 0) > excessThreshold;

  if (!hasExcess) return goals;

  const marketZones =
    deps.gameState.zones?.filter(
      (z) => z.type === ZoneType.MARKET,
    ) || [];

  if (marketZones.length === 0) return goals;

  const myPos = deps.getEntityPosition(aiState.entityId);
  if (!myPos) return goals;

  let nearestMarket: (typeof marketZones)[0] | null = null;
  let minDist = Infinity;

  for (const zone of marketZones) {
    const cx = zone.bounds.x + zone.bounds.width / 2;
    const cy = zone.bounds.y + zone.bounds.height / 2;
    const dist = Math.hypot(cx - myPos.x, cy - myPos.y);
    if (dist < minDist) {
      minDist = dist;
      nearestMarket = zone;
    }
  }

  if (nearestMarket) {
    goals.push({
      id: `trade_${aiState.entityId}_${now}`,
      type: GoalType.WORK,
      priority: 0.4, // Lower priority than critical needs
      targetZoneId: nearestMarket.id,
      data: {
        action: "trade",
      },
      createdAt: now,
      expiresAt: now + 20000,
    });
  }

  return goals;
}
