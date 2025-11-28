import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AIState } from "../../../../types/simulation/ai";
import type { PriorityManager } from "./PriorityManager";
import {
  GoalType,
  GoalDomain,
  NeedType,
  GoalPrefix,
} from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";

const PRIORITY_TIERS = {
  SURVIVAL_CRITICAL: 10.0,
  SURVIVAL_URGENT: 8.0,
  LOGISTICS: 6.0,
  OPPORTUNITY: 4.0,
  IDLE: 2.0,
} as const;

export function calculateNeedPriority(
  currentValue: number,
  urgencyMultiplier: number,
): number {
  const urgency = (100 - currentValue) / 100;
  return Math.min(1, urgency * (urgencyMultiplier / 100));
}

export function selectBestZone(
  aiState: AIState,
  zoneIds: string[],
  _zoneType: string,
  gameState: GameState,
  getPosition: (entityId: string) => { x: number; y: number } | null,
): string | null {
  if (zoneIds.length === 0) return null;

  const validZones = zoneIds
    .map((id) => gameState.zones?.find((z) => z.id === id))
    .filter(Boolean) as Array<{
    id: string;
    attractiveness?: number;
    bounds: { x: number; y: number; width: number; height: number };
    metadata?: {
      priority?: number;
      agentId?: string;
      zoneId?: string;
      resourceType?: string;
      underConstruction?: boolean;
      [key: string]: string | number | boolean | undefined;
    };
  }>;

  if (validZones.length === 0) return null;

  const personality = aiState.personality;
  const explorationBonus = 0.15 + personality.openness * 0.55;

  const evaluatedZones = validZones.map((zone) => {
    const distance = estimateDistance(aiState.entityId, zone, getPosition);
    const attractiveness = zone.attractiveness || 5;
    const memoryBonus = aiState.memory.successfulActivities.get(zone.id) || 0;
    const failurePenalty = aiState.memory.failedAttempts.get(zone.id) || 0;

    const isUnvisited = !aiState.memory.visitedZones.has(zone.id);
    const distanceBonus = isUnvisited ? (distance / 300) * explorationBonus : 0;
    const distancePenalty = isUnvisited ? 0 : distance / 1000;

    const underConstructionBonus =
      zone.metadata?.underConstruction === true ? 1.5 : 0;

    const score =
      attractiveness +
      memoryBonus -
      failurePenalty +
      distanceBonus -
      distancePenalty +
      underConstructionBonus;

    return { zone, score, distance, isUnvisited };
  });

  evaluatedZones.sort((a, b) => b.score - a.score);

  const randomChance =
    0.1 + personality.openness * 0.3 - personality.neuroticism * 0.2;

  if (
    evaluatedZones.length >= 3 &&
    Math.random() < Math.max(0.05, randomChance)
  ) {
    const topThree = evaluatedZones.slice(0, 3);
    const randomPick = topThree[Math.floor(Math.random() * topThree.length)];
    return randomPick.zone.id;
  }

  const bestZone = evaluatedZones[0];

  if (!bestZone || bestZone.score < -100) {
    return validZones[0]?.id || null;
  }

  return bestZone.zone.id;
}

function estimateDistance(
  entityId: string,
  zone: { bounds: { x: number; y: number; width: number; height: number } },
  getPosition: (entityId: string) => { x: number; y: number } | null,
): number {
  const entity = getPosition(entityId);
  if (!entity) return 1000;

  const zoneCenterX = zone.bounds.x + zone.bounds.width / 2;
  const zoneCenterY = zone.bounds.y + zone.bounds.height / 2;

  return Math.hypot(zoneCenterX - entity.x, zoneCenterY - entity.y);
}

export function getUnexploredZones(
  aiState: AIState,
  gameState: GameState,
): string[] {
  return (
    gameState.zones
      ?.filter((zone) => !aiState.memory.visitedZones.has(zone.id))
      .map((zone) => zone.id) || []
  );
}

export function prioritizeGoals(
  goals: AIGoal[],
  aiState: AIState,
  priorityManager: PriorityManager,
  minThreshold: number,
  softmaxTau: number = 0,
): AIGoal[] {
  const tieredGoals = goals.map((goal) => {
    const tier = getGoalTier(goal, aiState);
    const base = tier + goal.priority;
    const domain = getGoalDomain(goal);
    const adjusted = priorityManager.adjust(aiState.entityId, domain, base);
    return { ...goal, finalPriority: adjusted };
  });

  const filtered = tieredGoals.filter((goal) => goal.priority >= minThreshold);

  const sampleGumbel = (): number => {
    const u = Math.max(1e-12, Math.random());
    return -Math.log(-Math.log(u));
  };

  const withNoise = filtered.map((g) => ({
    ...g,
    noisyScore:
      (g as typeof g & { finalPriority: number }).finalPriority +
      (softmaxTau > 0 ? softmaxTau * sampleGumbel() : 0),
  }));

  return withNoise.sort((a, b) => b.noisyScore - a.noisyScore);
}

function getGoalDomain(goal: AIGoal): GoalDomain {
  if (goal.type === GoalType.SATISFY_NEED || goal.type === GoalType.REST)
    return GoalDomain.SURVIVAL;
  if (goal.type === GoalType.SOCIAL) return GoalDomain.SOCIAL;
  if (goal.type === GoalType.EXPLORE) return GoalDomain.EXPLORE;
  if (goal.type === GoalType.INSPECT) return GoalDomain.INSPECT;
  if (goal.type === GoalType.FLEE) return GoalDomain.FLEE;
  if (goal.type === GoalType.ATTACK) return GoalDomain.COMBAT;
  if (goal.type === GoalType.WORK) {
    if (goal.id?.startsWith(GoalPrefix.DEPOSIT)) return GoalDomain.LOGISTICS;
    if (goal.id?.startsWith("craft_weapon")) return GoalDomain.CRAFTING;
    return GoalDomain.WORK;
  }
  return GoalDomain.WORK;
}

export function getGoalTier(goal: AIGoal, _aiState: AIState): number {
  if (goal.type === GoalType.SATISFY_NEED) {
    if (
      goal.data?.need === NeedType.HUNGER ||
      goal.data?.need === NeedType.THIRST
    ) {
      if (goal.priority >= 0.8) return PRIORITY_TIERS.SURVIVAL_CRITICAL;
      if (goal.priority >= 0.5) return PRIORITY_TIERS.SURVIVAL_URGENT;
    }
    if (goal.data?.need === NeedType.ENERGY && goal.priority >= 0.7) {
      return PRIORITY_TIERS.SURVIVAL_URGENT;
    }
    return PRIORITY_TIERS.OPPORTUNITY;
  }

  // Emergency water/food collection tasks should have SURVIVAL_URGENT tier
  if (goal.type === GoalType.WORK) {
    const taskType = goal.data?.taskType as string | undefined;
    if (taskType === 'gather_water' || taskType === 'gather_food') {
      // High priority (>= 0.85) water/food tasks are emergency-level
      if (goal.priority >= 0.85) return PRIORITY_TIERS.SURVIVAL_URGENT;
      // Medium priority (>= 0.65) are still important
      if (goal.priority >= 0.65) return PRIORITY_TIERS.LOGISTICS;
    }
    if (goal.id?.startsWith(GoalPrefix.DEPOSIT)) {
      return PRIORITY_TIERS.LOGISTICS;
    }
  }

  // Deposit goals with water/food during emergency should be high priority
  if (goal.type === GoalType.DEPOSIT) {
    const data = goal.data as Record<string, unknown> | undefined;
    const hasWater = data?.hasWater as boolean | undefined;
    const hasFood = data?.hasFood as boolean | undefined;
    if ((hasWater || hasFood) && goal.priority >= 0.85) {
      return PRIORITY_TIERS.SURVIVAL_URGENT;
    }
    return PRIORITY_TIERS.LOGISTICS;
  }

  if (
    goal.type === GoalType.WORK ||
    goal.type === GoalType.SOCIAL ||
    goal.type === GoalType.EXPLORE ||
    goal.type === GoalType.ATTACK ||
    goal.type === GoalType.HUNT ||
    goal.type === GoalType.CRAFT ||
    goal.type === GoalType.ASSIST ||
    goal.type === GoalType.CONSTRUCTION
  ) {
    return PRIORITY_TIERS.OPPORTUNITY;
  }

  return PRIORITY_TIERS.IDLE;
}

export function getRecommendedZoneIdsForNeed(
  needType: string,
  gameState: GameState,
): string[] {
  const zoneTypes: Record<string, ZoneType[]> = {
    [NeedType.HUNGER]: [ZoneType.FOOD],
    [NeedType.THIRST]: [ZoneType.WATER],
    [NeedType.ENERGY]: [ZoneType.REST, ZoneType.SHELTER],
    [NeedType.MENTAL_HEALTH]: [
      ZoneType.SOCIAL,
      ZoneType.REST,
      ZoneType.SPIRITUAL,
      ZoneType.KNOWLEDGE,
      ZoneType.MEDICAL,
      ZoneType.MARKET,
      ZoneType.FUN,
    ],
    [NeedType.SOCIAL]: [ZoneType.SOCIAL, ZoneType.MARKET],
    [NeedType.FUN]: [ZoneType.FUN, ZoneType.ENTERTAINMENT],
    [NeedType.HYGIENE]: [ZoneType.HYGIENE],
  };

  const types = zoneTypes[needType] || [];
  return (
    gameState.zones
      ?.filter((z) => types.includes(z.type as ZoneType))
      .map((z) => z.id) || []
  );
}
