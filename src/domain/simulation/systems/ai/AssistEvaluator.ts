import { logger } from "../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../types/simulation/needs";

export interface AssistContext {
  getAllActiveAgentIds: () => string[];
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getNeeds: (id: string) => EntityNeedsData | undefined;
  getEntityStats: (id: string) => Record<string, number> | null;
  selectBestZone: (
    aiState: AIState,
    zoneIds: string[],
    zoneType: string,
  ) => string | null;
  getZoneIdsByType: (types: string[]) => string[];
}

export function evaluateAssist(
  ctx: AssistContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const helpRadius = 220 + personality.extraversion * 100;
    const empathyFactor = personality.agreeableness;

    const ids = ctx.getAllActiveAgentIds();
    const myPos = ctx.getEntityPosition(aiState.entityId);
    if (!myPos) return [];

    let best: {
      id: string;
      d: number;
      need: "water" | "food" | "medical" | "rest";
    } | null = null;

    for (const id of ids) {
      if (id === aiState.entityId) continue;
      const pos = ctx.getEntityPosition(id);
      if (!pos) continue;
      const d = Math.hypot(pos.x - myPos.x, pos.y - myPos.y);
      if (d > helpRadius) continue;

      const needs = ctx.getNeeds(id);
      const stats = ctx.getEntityStats(id) || {};
      let need: "water" | "food" | "medical" | "rest" | null = null;

      const sensitivity = 1.0 - empathyFactor * 0.3;

      if ((stats.wounds ?? 0) > 20 * sensitivity) need = "medical";
      else if ((needs?.thirst ?? 100) < 25 / sensitivity) need = "water";
      else if ((needs?.hunger ?? 100) < 25 / sensitivity) need = "food";
      else if (
        (needs?.energy ?? 100) < 25 / sensitivity ||
        (stats.morale ?? 100) < 35 / sensitivity
      )
        need = "rest";
      
      if (need && (!best || d < best.d)) best = { id, d, need } as const;
    }
    if (!best) return [];

    let targetZone: string | null = null;
    if (best.need === "medical")
      targetZone = ctx.selectBestZone(
        aiState,
        ctx.getZoneIdsByType(["medical"]),
        "work",
      );
    else if (best.need === "rest")
      targetZone = ctx.selectBestZone(
        aiState,
        ctx.getZoneIdsByType(["rest", "shelter"]),
        "rest",
      );
    else if (best.need === "food")
      targetZone = ctx.selectBestZone(
        aiState,
        ctx.getZoneIdsByType(["food"]),
        "food",
      );
    else if (best.need === "water")
      targetZone = ctx.selectBestZone(
        aiState,
        ctx.getZoneIdsByType(["water"]),
        "water",
      );
    
    if (!targetZone) return [];

    const priority = 0.4 + personality.agreeableness * 0.4;

    return [
      {
        id: `assist_${best.id}_${best.need}_${now}`,
        type: "assist",
        priority,
        targetZoneId: targetZone,
        data: {
            targetAgentId: best.id,
            resourceType: best.need,
            amount: 10
        },
        createdAt: now,
        expiresAt: now + 4000,
      },
    ];
  } catch (error) {
    logger.error("Failed to evaluate assist goals", {
      entityId: aiState.entityId,
      error,
    });
    return [];
  }
}