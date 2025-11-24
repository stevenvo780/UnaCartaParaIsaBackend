import type { GameState } from "../../../types/game-types";
import type { AIGoal, AIState } from "../../../types/simulation/ai";
import type { PriorityManager, GoalDomain } from "./PriorityManager";

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
      [key: string]: string | number | undefined;
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
      zone.metadata?.["underConstruction"] === true ? 1.5 : 0;

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

/**
 * Returns list of zone IDs that haven't been visited by the agent
 */
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

/**
 * Prioritizes goals using domain weights and tiering
 */
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
  if (goal.type === "satisfy_need" || goal.type === "rest") return "survival";
  if (goal.type === "social") return "social";
  if (goal.type === "explore") return "explore";
  if (goal.type === "inspect") return "inspect";
  if (goal.type === "flee") return "flee";
  if (goal.type === "attack") return "combat";
  if (goal.type === "work") {
    if (goal.id?.startsWith("deposit_")) return "logistics";
    if (goal.id?.startsWith("craft_weapon")) return "crafting";
    return "work";
  }
  return "work";
}

export function getGoalTier(goal: AIGoal, _aiState: AIState): number {
  if (goal.type === "satisfy_need") {
    if (goal.data?.need === "hunger" || goal.data?.need === "thirst") {
      if (goal.priority >= 0.8) return PRIORITY_TIERS.SURVIVAL_CRITICAL;
      if (goal.priority >= 0.5) return PRIORITY_TIERS.SURVIVAL_URGENT;
    }
    if (goal.data?.need === "energy" && goal.priority >= 0.7) {
      return PRIORITY_TIERS.SURVIVAL_URGENT;
    }
    return PRIORITY_TIERS.OPPORTUNITY;
  }

  if (goal.type === "work" && goal.id?.startsWith("deposit_")) {
    return PRIORITY_TIERS.LOGISTICS;
  }

  if (
    goal.type === "work" ||
    goal.type === "social" ||
    goal.type === "explore" ||
    goal.type === "attack"
  ) {
    return PRIORITY_TIERS.OPPORTUNITY;
  }

  return PRIORITY_TIERS.IDLE;
}

export function getRecommendedZoneIdsForNeed(
  needType: string,
  gameState: GameState,
): string[] {
  const zoneTypes: Record<string, string[]> = {
    hunger: ["food"],
    thirst: ["water"],
    energy: ["rest", "shelter"],
    mentalHealth: [
      "social",
      "rest",
      "spiritual",
      "knowledge",
      "medical",
      "market",
      "fun",
    ],
    social: ["social", "market"],
    fun: ["fun", "entertainment"],
    hygiene: ["hygiene"],
  };

  const types = zoneTypes[needType] || [];
  return (
    gameState.zones?.filter((z) => types.includes(z.type)).map((z) => z.id) ||
    []
  );
}

export function getEntityPosition(
  entityId: string,
  gameState: GameState,
): { x: number; y: number } | null {
  const agent = gameState.agents?.find((a) => a.id === entityId);
  if (agent?.position) {
    return { x: agent.position.x, y: agent.position.y };
  }

  const entity = gameState.entities?.find(
    (e: { id: string }) => e.id === entityId,
  ) as { position?: { x: number; y: number } } | undefined;

  return entity?.position || { x: 0, y: 0 };
}
