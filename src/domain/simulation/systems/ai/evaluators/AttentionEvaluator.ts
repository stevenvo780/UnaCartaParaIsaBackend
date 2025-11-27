import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { GameState } from "../../../../types/game-types";
import { RandomUtils } from "../../../../../shared/utils/RandomUtils";
import {
  GoalType,
  ExplorationType,
} from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";

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

  const pick = RandomUtils.element(nearby);
  if (!pick) return [];

  return [
    {
      id: `inspect_${now}`,
      type: GoalType.EXPLORE,
      priority: 0.5 * curiosityBoost,
      targetId: pick.res.id,
      targetPosition: pick.res.position,
      data: {
        explorationType: ExplorationType.INSPECT,
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
      ?.filter((z) => z.type === ZoneType.REST || z.type === ZoneType.SHELTER)
      .map((z) => z.id) || [];

  const allZones = ctx.gameState.zones?.map((z) => z.id) || [];
  const candidates = restZones.length > 0 ? restZones : allZones;

  if (candidates.length === 0) {
    return [
      {
        id: `wander_${now}`,
        type: GoalType.EXPLORE,
        priority: 0.3,
        data: {
          explorationType: ExplorationType.WANDER,
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
    return [
      {
        id: `wander_fallback_${now}`,
        type: GoalType.EXPLORE,
        priority: 0.3,
        data: {
          explorationType: ExplorationType.WANDER,
        },
        createdAt: now,
        expiresAt: now + 8000,
      },
    ];
  }

  return [
    {
      id: `default_${now}`,
      type: restZones.length > 0 ? GoalType.REST : GoalType.EXPLORE,
      priority: 0.35,
      targetZoneId: best,
      data: {
        explorationType: ExplorationType.DEFAULT,
      },
      createdAt: now,
      expiresAt: now + 6000,
    },
  ];
}
