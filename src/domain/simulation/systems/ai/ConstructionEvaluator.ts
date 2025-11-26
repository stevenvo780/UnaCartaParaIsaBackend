import { logger } from "../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { GameState } from "../../../types/game-types";

export interface ConstructionContext {
  gameState: GameState;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getTasks: () => Array<{
    id: string;
    type: string;
    zoneId?: string;
    completed?: boolean;
    contributors?: Map<string, number>;
    requirements?: { minWorkers?: number };
  }>;
}

export function evaluateConstructionGoals(
  ctx: ConstructionContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const dutyFactor = personality.conscientiousness;
    const communityFactor = personality.agreeableness;

    const tasks = ctx.getTasks();
    const buildTasks = tasks.filter(
      (t) =>
        (t.type === "build_house" ||
          t.type === "build_mine" ||
          t.type === "build_workbench") &&
        !t.completed &&
        t.zoneId,
    );

    if (buildTasks.length === 0) return [];

    const myPos = ctx.getEntityPosition(aiState.entityId);
    if (!myPos) return [];

    const ranked = buildTasks
      .map((t) => {
        const zone = ctx.gameState.zones?.find((z) => z.id === t.zoneId);
        if (!zone) return null;

        if (
          !zone.bounds ||
          zone.bounds.width === 0 ||
          zone.bounds.height === 0
        ) {
          logger.debug(
            `🚧 Construcción ${t.zoneId} sin geometría válida, omitiendo`,
            { entityId: aiState.entityId },
          );
          return null;
        }

        const cx = zone.bounds.x + zone.bounds.width / 2;
        const cy = zone.bounds.y + zone.bounds.height / 2;
        const d = Math.hypot(cx - myPos.x, cy - myPos.y);
        const minW = t.requirements?.minWorkers ?? 1;
        const have = t.contributors?.size ?? 0;
        const need = Math.max(0, minW - have);
        const score = need * 2 - d / 600;
        return { t, zoneId: t.zoneId!, score };
      })
      .filter(Boolean) as Array<{
      t: (typeof buildTasks)[number];
      zoneId: string;
      score: number;
    }>;

    if (ranked.length === 0) return [];
    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0];

    const priority = 0.3 + dutyFactor * 0.4 + communityFactor * 0.2;

    return [
      {
        id: `assist_build_${best.t.id}_${now}`,
        type: "construction",
        priority,
        targetZoneId: best.zoneId,
        data: {
          taskId: best.t.id,
          workType: "construction",
        },
        createdAt: now,
        expiresAt: now + 8000,
      },
    ];
  } catch (error) {
    logger.error("Failed to evaluate construction opportunity", {
      entityId: aiState.entityId,
      error,
    });
    return [];
  }
}
