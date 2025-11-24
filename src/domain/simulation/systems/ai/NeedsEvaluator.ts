import type { AIState, AIGoal } from '../../../types/simulation/ai';
import type { EntityNeedsData } from '../../../types/simulation/needs';

export interface NeedsEvaluatorDependencies {
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  findNearestResource?: (
    entityId: string,
    resourceType: string
  ) => { id: string; x: number; y: number } | null;
}

export function calculateNeedPriority(
  currentValue: number,
  urgencyMultiplier: number = 100
): number {
  if (currentValue >= 80) return 0;
  if (currentValue >= 60) return 0.2;
  if (currentValue >= 40) return 0.5;
  if (currentValue >= 20) return 0.8;
  return 1.0 * (urgencyMultiplier / 100);
}

export function evaluateCriticalNeeds(
  deps: NeedsEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);

  if (!entityNeeds) {
    return goals;
  }

  const { needs } = entityNeeds;
  const now = Date.now();

  // Thresholds based on personality
  const hungerThreshold = 45;
  const thirstThreshold = 40;
  const energyThreshold = 35;

  // Critical: Thirst (highest priority)
  if (needs.thirst < thirstThreshold) {
    let waterTarget = null;
    if (deps.findNearestResource) {
      waterTarget = deps.findNearestResource(aiState.entityId, 'water_source');
    }

    if (waterTarget) {
      goals.push({
        type: 'satisfy_need',
        priority: calculateNeedPriority(needs.thirst, 130),
        targetId: waterTarget.id,
        targetPosition: { x: waterTarget.x, y: waterTarget.y },
        data: {
          need: 'thirst',
          resourceType: 'water',
        },
        createdAt: now,
        expiresAt: now + 15000,
      });
    }
  }

  // Critical: Hunger
  if (needs.hunger < hungerThreshold) {
    let foodTarget = null;
    if (deps.findNearestResource) {
      // Try wheat first
      foodTarget = deps.findNearestResource(aiState.entityId, 'wheat');

      // Then berries
      if (!foodTarget) {
        foodTarget = deps.findNearestResource(aiState.entityId, 'berry_bush');
      }

      // Then mushrooms
      if (!foodTarget) {
        foodTarget = deps.findNearestResource(aiState.entityId, 'mushroom_patch');
      }
    }

    if (foodTarget) {
      goals.push({
        type: 'satisfy_need',
        priority: calculateNeedPriority(needs.hunger, 110),
        targetId: foodTarget.id,
        targetPosition: { x: foodTarget.x, y: foodTarget.y },
        data: {
          need: 'hunger',
          resourceType: 'food',
        },
        createdAt: now,
        expiresAt: now + 15000,
      });
    }
  }

  // Energy (rest/sleep)
  if (needs.energy < energyThreshold) {
    goals.push({
      type: 'satisfy_need',
      priority: calculateNeedPriority(needs.energy, 80),
      data: {
        need: 'energy',
        action: 'rest',
      },
      createdAt: now,
      expiresAt: now + 20000,
    });
  }

  // Mental health (social)
  if (needs.mentalHealth < 50) {
    goals.push({
      type: 'social',
      priority: calculateNeedPriority(needs.mentalHealth, 70),
      data: {
        need: 'mentalHealth',
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  return goals;
}
