import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { GameState } from "../../../types/game-types";

export interface AttentionContext {
  gameState: GameState;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  selectBestZone: (
    aiState: AIState,
    zoneIds: string[],
    zoneType: string,
  ) => string | null;
}

export function evaluateAttention(
  ctx: AttentionContext,
  aiState: AIState,
): AIGoal[] {
  const pos = ctx.getEntityPosition(aiState.entityId);
  if (!pos) return [];
  const now = Date.now();

  const ATTENTION_RADIUS = 600;

  const resources = Object.values(ctx.gameState.worldResources || {});

  const nearby = resources
    .map((res) => ({
      res,
      d: Math.hypot(res.position.x - pos.x, res.position.y - pos.y),
    }))
    .filter(({ d }) => d > 50 && d < ATTENTION_RADIUS)
    .sort((a, b) => a.d - b.d);

  if (nearby.length === 0) return [];

  const curiosityBoost = 0.7 + aiState.personality.openness * 0.6;

  const pick = nearby[Math.floor(Math.random() * Math.min(8, nearby.length))];

  return [
    {
      id: `inspect_${now}`,
      type: "explore", // 'inspect' might not be a valid type in backend yet, using explore
      priority: 0.5 * curiosityBoost,
      targetId: pick.res.id,
      targetPosition: pick.res.position,
      data: {
        explorationType: "inspect",
      },
      createdAt: now,
      expiresAt: now + 3000,
    },
  ];
}

export function evaluateDefaultExploration(
  ctx: AttentionContext,
  aiState: AIState,
): AIGoal[] {
  const now = Date.now();
  const restZones =
    ctx.gameState.zones
      ?.filter((z) => z.type === "rest" || z.type === "shelter")
      .map((z) => z.id) || [];

  const allZones = ctx.gameState.zones?.map((z) => z.id) || [];
  const candidates = restZones.length > 0 ? restZones : allZones;

  if (candidates.length === 0) {
    // No zones found, wander randomly
    return [
      {
        id: `wander_${now}`,
        type: "explore",
        priority: 0.3,
        data: {
          explorationType: "wander",
        },
        createdAt: now,
        expiresAt: now + 8000,
      },
    ];
  }

  const best = ctx.selectBestZone(
    aiState,
    candidates,
    restZones.length > 0 ? "rest" : "explore",
  );

  if (!best) {
    // Fallback if selectBestZone fails
    return [
      {
        id: `wander_fallback_${now}`,
        type: "explore",
        priority: 0.3,
        data: {
          explorationType: "wander",
        },
        createdAt: now,
        expiresAt: now + 8000,
      },
    ];
  }

  return [
    {
      id: `default_${now}`,
      type: restZones.length > 0 ? "rest" : "explore",
      priority: 0.35,
      targetZoneId: best,
      data: {
        explorationType: "default",
      },
      createdAt: now,
      expiresAt: now + 6000,
    },
  ];
}
