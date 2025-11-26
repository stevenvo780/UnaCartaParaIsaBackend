import { logger } from "../../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";

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
  // Optional: pre-computed nearby agents with distances (GPU-accelerated)
  getNearbyAgentsWithDistances?: (
    entityId: string,
    radius: number,
  ) => Array<{ id: string; distance: number }>;
}

export function evaluateAssist(ctx: AssistContext, aiState: AIState): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const helpRadius = 220 + personality.extraversion * 100;
    const empathyFactor = personality.agreeableness;

    let best: {
      id: string;
      d: number;
      need: "water" | "food" | "medical" | "rest" | "social";
    } | null = null;

    // Use GPU-accelerated nearby search if available
    if (ctx.getNearbyAgentsWithDistances) {
      const nearbyAgents = ctx.getNearbyAgentsWithDistances(
        aiState.entityId,
        helpRadius,
      );

      for (const { id, distance } of nearbyAgents) {
        const needs = ctx.getNeeds(id);
        const stats = ctx.getEntityStats(id) || {};
        let need: "water" | "food" | "medical" | "rest" | "social" | null =
          null;

        const sensitivity = 1.0 - empathyFactor * 0.3;

        if ((stats.wounds ?? 0) > 20 * sensitivity) need = "medical";
        else if ((needs?.thirst ?? 100) < 25 / sensitivity) need = "water";
        else if ((needs?.hunger ?? 100) < 25 / sensitivity) need = "food";
        else if (
          (needs?.energy ?? 100) < 25 / sensitivity ||
          (stats.morale ?? 100) < 35 / sensitivity
        )
          need = "rest";
        else if (
          (needs?.social ?? 100) < 30 / sensitivity ||
          (needs?.fun ?? 100) < 30 / sensitivity
        )
          need = "social";

        if (need && (!best || distance < best.d)) {
          best = { id, d: distance, need };
        }
      }
    } else {
      // Fallback: manual distance calculation
      const ids = ctx.getAllActiveAgentIds();
      const myPos = ctx.getEntityPosition(aiState.entityId);
      if (!myPos) return [];

      const helpRadiusSq = helpRadius * helpRadius;

      for (const id of ids) {
        if (id === aiState.entityId) continue;

        const pos = ctx.getEntityPosition(id);
        if (!pos) continue;

        const dx = pos.x - myPos.x;
        const dy = pos.y - myPos.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > helpRadiusSq) continue;

        const d = Math.sqrt(dSq);
        const needs = ctx.getNeeds(id);
        const stats = ctx.getEntityStats(id) || {};
        let need: "water" | "food" | "medical" | "rest" | "social" | null =
          null;

        const sensitivity = 1.0 - empathyFactor * 0.3;

        if ((stats.wounds ?? 0) > 20 * sensitivity) need = "medical";
        else if ((needs?.thirst ?? 100) < 25 / sensitivity) need = "water";
        else if ((needs?.hunger ?? 100) < 25 / sensitivity) need = "food";
        else if (
          (needs?.energy ?? 100) < 25 / sensitivity ||
          (stats.morale ?? 100) < 35 / sensitivity
        )
          need = "rest";
        else if (
          (needs?.social ?? 100) < 30 / sensitivity ||
          (needs?.fun ?? 100) < 30 / sensitivity
        )
          need = "social";

        if (need && (!best || d < best.d)) best = { id, d, need } as const;
      }
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
    else if (best.need === "social")
      targetZone = ctx.selectBestZone(
        aiState,
        ctx.getZoneIdsByType(["social", "gathering", "market"]),
        "social",
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
          amount: 10,
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
