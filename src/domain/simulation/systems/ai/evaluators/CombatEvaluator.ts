import { logger } from "../../../../../infrastructure/utils/logger";
import type { AIState, AIGoal } from "../../../../types/simulation/ai";

export interface CombatContext {
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getEntityStats: (id: string) => Record<string, number> | null;
  getStrategy: (id: string) => "peaceful" | "tit_for_tat" | "bully";
  isWarrior: (id: string) => boolean;
  getEnemiesForAgent: (id: string, threshold?: number) => string[];
  getNearbyPredators: (
    pos: { x: number; y: number },
    range: number,
  ) => Array<{ id: string; position: { x: number; y: number } }>;
}

export function evaluateCombatGoals(
  ctx: CombatContext,
  aiState: AIState,
): AIGoal[] {
  try {
    const { personality } = aiState;
    const now = Date.now();

    const enemies = ctx.getEnemiesForAgent(aiState.entityId, 0.5) || [];
    const myPos = ctx.getEntityPosition(aiState.entityId);

    const goals: AIGoal[] = [];

    if (myPos) {
      if (enemies.length > 0) {
        const nearest = enemies
          .map((id) => ({ id, pos: ctx.getEntityPosition(id) }))
          .filter((e) => !!e.pos)
          .map((e) => ({
            id: e.id,
            pos: e.pos!,
            d: Math.hypot(e.pos!.x - myPos.x, e.pos!.y - myPos.y),
          }))
          .sort((a, b) => a.d - b.d)[0];

        if (nearest) {
          const isWarrior = ctx.isWarrior(aiState.entityId);
          const stats = ctx.getEntityStats(aiState.entityId) || {};
          const morale = stats?.morale ?? 60;
          const mental = stats?.mentalHealth ?? 60;

          const panicThreshold = 40 + personality.neuroticism * 20;
          const lowFactor = morale < panicThreshold || mental < 35 ? 1.5 : 1.0;

          const DANGER =
            90 *
            (morale < panicThreshold ? 1.6 : 1.0) *
            (1 + personality.neuroticism * 0.5);
          const SEEK =
            180 *
            (morale > 60 ? 1.0 : 0.8) *
            (1 + (1 - personality.agreeableness) * 0.5);

          const strategy = ctx.getStrategy(aiState.entityId);
          const tStats = ctx.getEntityStats(nearest.id) || {};
          const myPower = (morale || 0) + (stats?.stamina ?? 50);
          const theirPower = (tStats.morale || 50) + (tStats.stamina || 50);
          const advantage = theirPower > 0 ? myPower / theirPower : 1.0;

          if (!isWarrior && nearest.d < DANGER) {
            const dx = myPos.x - nearest.pos.x;
            const dy = myPos.y - nearest.pos.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const scale = (140 * lowFactor) / len;
            const fleePos = {
              x: myPos.x + dx * scale,
              y: myPos.y + dy * scale,
            };

            goals.push({
              id: `flee_${now}`,
              type: "flee",
              priority: morale < panicThreshold ? 0.95 : 0.85,
              targetPosition: fleePos,
              createdAt: now,
              expiresAt: now + 3000,
              data: { reason: "enemy_too_close" },
            });
          } else if (nearest.d < SEEK) {
            let shouldAttack = false;
            if (strategy === "peaceful") {
              shouldAttack = false;
            } else if (strategy === "tit_for_tat") {
              const act = ctx.getEnemiesForAgent(aiState.entityId, 0.6) || [];
              shouldAttack = act.includes(nearest.id) && advantage >= 0.7;
            } else {
              const aggressionThreshold =
                0.9 - (1 - personality.agreeableness) * 0.2;
              shouldAttack = advantage >= aggressionThreshold;
            }

            if (shouldAttack) {
              goals.push({
                id: `attack_${nearest.id}_${now}`,
                type: "attack",
                priority: 0.9 * Math.min(1.2, advantage),
                targetId: nearest.id,
                targetPosition: nearest.pos,
                createdAt: now,
                expiresAt: now + 5000,
                data: { reason: "aggression" },
              });
            }
          }
        }
      }

      const predators = ctx.getNearbyPredators(myPos, 200);
      for (const predator of predators) {
        const isWarrior = ctx.isWarrior(aiState.entityId);
        const stats = ctx.getEntityStats(aiState.entityId) || {};
        const morale = stats.morale ?? 50;
        const health = stats.health ?? 100;

        const fightThreshold = 60 + personality.neuroticism * 20;
        const canFight = isWarrior || (morale > fightThreshold && health > 50);

        if (canFight) {
          goals.push({
            id: `attack_animal_${predator.id}_${now}`,
            type: "attack",
            priority: 0.95,
            targetId: predator.id,
            targetPosition: predator.position,
            createdAt: now,
            expiresAt: now + 5000,
            data: { reason: "predator_defense" },
          });
        } else {
          const dx = myPos.x - predator.position.x;
          const dy = myPos.y - predator.position.y;
          const len = Math.max(1, Math.hypot(dx, dy));
          const scale = 200 / len;
          const fleePos = {
            x: myPos.x + dx * scale,
            y: myPos.y + dy * scale,
          };

          goals.push({
            id: `flee_animal_${predator.id}_${now}`,
            type: "flee",
            priority: 1.0,
            targetPosition: fleePos,
            createdAt: now,
            expiresAt: now + 3000,
            data: { reason: "predator_panic" },
          });
        }
      }
    }

    return goals;
  } catch (error) {
    logger.error("Failed to evaluate threat/combat goals", {
      entityId: aiState.entityId,
      error,
    });
    return [];
  }
}
