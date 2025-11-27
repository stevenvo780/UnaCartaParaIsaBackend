import type {
  AIState,
  AIGoal,
  GoalType,
} from "../../../../types/simulation/ai";
import type { GameState } from "../../../../types/game-types";
import type {
  Inventory,
  ResourceType,
} from "../../../../types/simulation/economy";
import type { RoleType } from "../../../../types/simulation/roles";
import type { SettlementDemand } from "../../../../types/simulation/governance";

/**
 * Configuration for collective needs thresholds.
 * These define when the community needs more resources.
 */
interface CollectiveThresholds {
  /** Minimum food per capita before urgent gathering */
  foodPerCapita: number;
  /** Minimum water per capita before urgent gathering */
  waterPerCapita: number;
  /** Minimum wood in stockpiles before gathering priority increases */
  minWoodReserve: number;
  /** Minimum stone in stockpiles before gathering priority increases */
  minStoneReserve: number;
  /** Stockpile fill ratio below which gathering is encouraged */
  stockpileFillTarget: number;
  /** When stockpiles reach this % full, agents should build more storage */
  storageExpansionThreshold: number;
}

const DEFAULT_COLLECTIVE_THRESHOLDS: CollectiveThresholds = {
  foodPerCapita: 10,
  waterPerCapita: 15,
  minWoodReserve: 100,
  minStoneReserve: 50,
  stockpileFillTarget: 0.7,
  storageExpansionThreshold: 0.85,
};

/**
 * Role-based priority modifiers.
 * Different roles have different motivations for collective work.
 */
const ROLE_COLLECTIVE_MODIFIERS: Record<
  RoleType,
  {
    gatherPriority: number;
    buildPriority: number;
    depositPriority: number;
    preferredResource?: ResourceType;
  }
> = {
  logger: {
    gatherPriority: 1.3,
    buildPriority: 0.8,
    depositPriority: 1.2,
    preferredResource: "wood",
  },
  quarryman: {
    gatherPriority: 1.3,
    buildPriority: 0.8,
    depositPriority: 1.2,
    preferredResource: "stone",
  },
  builder: {
    gatherPriority: 0.9,
    buildPriority: 1.5,
    depositPriority: 1.0,
  },
  farmer: {
    gatherPriority: 1.2,
    buildPriority: 0.7,
    depositPriority: 1.1,
    preferredResource: "food",
  },
  gatherer: {
    gatherPriority: 1.4,
    buildPriority: 0.6,
    depositPriority: 1.3,
    preferredResource: "water",
  },
  guard: {
    gatherPriority: 0.5,
    buildPriority: 0.7,
    depositPriority: 0.8,
  },
  hunter: {
    gatherPriority: 1.1,
    buildPriority: 0.6,
    depositPriority: 1.0,
    preferredResource: "food",
  },
  craftsman: {
    gatherPriority: 0.8,
    buildPriority: 1.2,
    depositPriority: 1.1,
  },
  leader: {
    gatherPriority: 0.6,
    buildPriority: 0.8,
    depositPriority: 0.9,
  },
  idle: {
    gatherPriority: 1.0,
    buildPriority: 1.0,
    depositPriority: 1.0,
  },
};

export interface CollectiveNeedsContext {
  gameState: GameState;
  getAgentInventory: (id: string) => Inventory | undefined;
  getAgentRole: (id: string) => { roleType: RoleType } | undefined;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getAllStockpiles: () => Array<{
    id: string;
    zoneId: string;
    inventory: Inventory;
    capacity: number;
  }>;
  getActiveDemands?: () => SettlementDemand[];
  getPopulation: () => number;
}

interface CollectiveNeedsState {
  totalFood: number;
  totalWater: number;
  totalWood: number;
  totalStone: number;
  totalStockpileCapacity: number;
  usedStockpileCapacity: number;
  population: number;
  foodPerCapita: number;
  waterPerCapita: number;
  stockpileFillRatio: number;
  activeDemands: SettlementDemand[];
}

/**
 * Calculates the collective needs state of the settlement.
 */
function calculateCollectiveState(
  ctx: CollectiveNeedsContext,
): CollectiveNeedsState {
  const stockpiles = ctx.getAllStockpiles();
  const population = ctx.getPopulation();

  let totalFood = 0;
  let totalWater = 0;
  let totalWood = 0;
  let totalStone = 0;
  let totalCapacity = 0;
  let usedCapacity = 0;

  for (const sp of stockpiles) {
    totalFood += sp.inventory.food || 0;
    totalWater += sp.inventory.water || 0;
    totalWood += sp.inventory.wood || 0;
    totalStone += sp.inventory.stone || 0;
    totalCapacity += sp.capacity;
    usedCapacity +=
      (sp.inventory.food || 0) +
      (sp.inventory.water || 0) +
      (sp.inventory.wood || 0) +
      (sp.inventory.stone || 0) +
      (sp.inventory.rare_materials || 0);
  }

  const activeDemands = ctx.getActiveDemands?.() || [];

  return {
    totalFood,
    totalWater,
    totalWood,
    totalStone,
    totalStockpileCapacity: totalCapacity,
    usedStockpileCapacity: usedCapacity,
    population: Math.max(1, population),
    foodPerCapita: totalFood / Math.max(1, population),
    waterPerCapita: totalWater / Math.max(1, population),
    stockpileFillRatio: totalCapacity > 0 ? usedCapacity / totalCapacity : 0,
    activeDemands,
  };
}

/**
 * Determines what resource the community needs most urgently.
 */
function getMostNeededResource(
  state: CollectiveNeedsState,
  thresholds: CollectiveThresholds,
): { resource: ResourceType; urgency: number } | null {
  const needs: Array<{ resource: ResourceType; urgency: number }> = [];

  // Check food per capita
  if (state.foodPerCapita < thresholds.foodPerCapita) {
    const urgency = 1 - state.foodPerCapita / thresholds.foodPerCapita;
    needs.push({ resource: "food", urgency: Math.min(1, urgency * 1.5) });
  }

  // Check water per capita
  if (state.waterPerCapita < thresholds.waterPerCapita) {
    const urgency = 1 - state.waterPerCapita / thresholds.waterPerCapita;
    needs.push({ resource: "water", urgency: Math.min(1, urgency * 1.3) });
  }

  // Check wood reserves
  if (state.totalWood < thresholds.minWoodReserve) {
    const urgency = 1 - state.totalWood / thresholds.minWoodReserve;
    needs.push({ resource: "wood", urgency: Math.min(1, urgency) });
  }

  // Check stone reserves
  if (state.totalStone < thresholds.minStoneReserve) {
    const urgency = 1 - state.totalStone / thresholds.minStoneReserve;
    needs.push({ resource: "stone", urgency: Math.min(1, urgency * 0.9) });
  }

  // Sort by urgency descending
  needs.sort((a, b) => b.urgency - a.urgency);
  return needs[0] || null;
}

/**
 * Evaluates collective needs and generates goals for the community.
 * These goals consider not just individual needs but the prosperity of the settlement.
 */
export function evaluateCollectiveNeeds(
  ctx: CollectiveNeedsContext,
  aiState: AIState,
  now: number,
  thresholds: CollectiveThresholds = DEFAULT_COLLECTIVE_THRESHOLDS,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const state = calculateCollectiveState(ctx);
  const role = ctx.getAgentRole(aiState.entityId);
  const roleType = role?.roleType || "idle";
  const modifiers =
    ROLE_COLLECTIVE_MODIFIERS[roleType] || ROLE_COLLECTIVE_MODIFIERS.idle;
  const inventory = ctx.getAgentInventory(aiState.entityId);
  const position = ctx.getEntityPosition(aiState.entityId);

  if (!position) return goals;

  // 1. Check for governance demands and boost priority accordingly
  const foodDemand = state.activeDemands.find(
    (d) => d.type === "food_shortage" && !d.resolvedAt,
  );
  const waterDemand = state.activeDemands.find(
    (d) => d.type === "water_shortage" && !d.resolvedAt,
  );
  const housingDemand = state.activeDemands.find(
    (d) => d.type === "housing_full" && !d.resolvedAt,
  );

  // 2. Evaluate resource gathering for collective needs
  const mostNeeded = getMostNeededResource(state, thresholds);

  if (mostNeeded) {
    // Base priority for collective gathering
    let basePriority = 0.4 + mostNeeded.urgency * 0.35;

    // Boost if there's an active governance demand
    if (
      (mostNeeded.resource === "food" && foodDemand) ||
      (mostNeeded.resource === "water" && waterDemand)
    ) {
      basePriority += 0.2;
    }

    // Apply role modifier
    let finalPriority = basePriority * modifiers.gatherPriority;

    // Extra boost if this is the role's preferred resource
    if (modifiers.preferredResource === mostNeeded.resource) {
      finalPriority += 0.15;
    }

    // Personality influence: diligent agents contribute more
    finalPriority += aiState.personality.diligence * 0.1;
    finalPriority += aiState.personality.conscientiousness * 0.05;

    // Cap priority
    finalPriority = Math.min(0.85, Math.max(0.3, finalPriority));

    const resourceGoalType = getGatherGoalType(mostNeeded.resource);

    goals.push({
      id: `collective_gather_${mostNeeded.resource}_${now}`,
      type: resourceGoalType,
      priority: finalPriority,
      data: {
        resourceType: mostNeeded.resource,
        collectiveNeed: "true",
        urgency: mostNeeded.urgency,
        settlementNeed: mostNeeded.resource,
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  // 3. Evaluate deposit goals when agent has resources and stockpiles need filling
  if (inventory) {
    const agentLoad =
      (inventory.wood || 0) +
      (inventory.stone || 0) +
      (inventory.food || 0) +
      (inventory.water || 0);
    const agentCapacity = inventory.capacity || 50;
    const loadRatio = agentLoad / agentCapacity;

    // Lower threshold for depositing when community needs reserves
    const depositThreshold =
      state.stockpileFillRatio < thresholds.stockpileFillTarget
        ? 0.3 // Deposit earlier when stockpiles are low
        : 0.6; // Normal threshold

    if (loadRatio > depositThreshold && agentLoad > 5) {
      let depositPriority = 0.5 + (loadRatio - depositThreshold) * 0.4;
      depositPriority *= modifiers.depositPriority;

      // Boost if stockpiles are very low
      if (state.stockpileFillRatio < 0.3) {
        depositPriority += 0.2;
      }

      depositPriority = Math.min(0.8, Math.max(0.4, depositPriority));

      goals.push({
        id: `collective_deposit_${now}`,
        type: "deposit",
        priority: depositPriority,
        data: {
          collectiveNeed: "true",
          stockpileFillRatio: state.stockpileFillRatio,
        },
        createdAt: now,
        expiresAt: now + 20000,
      });
    }
  }

  // 4. Evaluate storage expansion when stockpiles are getting full
  if (state.stockpileFillRatio > thresholds.storageExpansionThreshold) {
    let buildPriority =
      0.5 +
      (state.stockpileFillRatio - thresholds.storageExpansionThreshold) * 2;
    buildPriority *= modifiers.buildPriority;

    // Boost for builders
    if (roleType === "builder") {
      buildPriority += 0.2;
    }

    // Check if there's already a housing demand (might indicate overcrowding)
    if (housingDemand) {
      buildPriority += 0.1;
    }

    buildPriority = Math.min(0.75, Math.max(0.4, buildPriority));

    goals.push({
      id: `collective_build_storage_${now}`,
      type: "construction",
      priority: buildPriority,
      data: {
        constructionType: "storage",
        collectiveNeed: "true",
        stockpileFillRatio: state.stockpileFillRatio,
      },
      createdAt: now,
      expiresAt: now + 60000,
    });
  }

  // 5. General prosperity goal: even if personal needs are met, contribute
  // This activates when the agent has nothing urgent and community reserves are moderate
  if (goals.length === 0 && state.stockpileFillRatio < 0.5 && inventory) {
    const prosperityPriority = 0.35 + aiState.personality.diligence * 0.15;

    // Pick a resource to gather based on what's lowest
    const lowestResource = getLowestResource(state);

    goals.push({
      id: `prosperity_gather_${lowestResource}_${now}`,
      type: "gather",
      priority: prosperityPriority,
      data: {
        resourceType: lowestResource,
        collectiveNeed: "true",
        prosperityDrive: "true",
      },
      createdAt: now,
      expiresAt: now + 45000,
    });
  }

  return goals;
}

/**
 * Returns the goal type for gathering a specific resource.
 */
function getGatherGoalType(resource: ResourceType): GoalType {
  switch (resource) {
    case "food":
      return "gather";
    case "water":
      return "gather";
    case "wood":
      return "work";
    case "stone":
      return "work";
    default:
      return "gather";
  }
}

/**
 * Returns the resource type with the lowest reserves relative to need.
 */
function getLowestResource(state: CollectiveNeedsState): ResourceType {
  const ratios = [
    { resource: "food" as ResourceType, ratio: state.foodPerCapita / 10 },
    { resource: "water" as ResourceType, ratio: state.waterPerCapita / 15 },
    { resource: "wood" as ResourceType, ratio: state.totalWood / 100 },
    { resource: "stone" as ResourceType, ratio: state.totalStone / 50 },
  ];

  ratios.sort((a, b) => a.ratio - b.ratio);
  return ratios[0].resource;
}

/**
 * Adjusts individual need thresholds based on agent's role and community state.
 * Roles have different tolerances - a farmer might not eat until later because
 * they're focused on producing food for others.
 */
export function adjustNeedThresholdsForRole(
  baseThreshold: number,
  need: "hunger" | "thirst" | "energy" | "social" | "fun",
  roleType: RoleType,
  collectiveState: CollectiveNeedsState,
): number {
  let modifier = 1.0;

  // Role-specific adjustments
  switch (roleType) {
    case "farmer":
    case "gatherer":
      // Food/water producers are more tolerant of their own hunger/thirst
      // when the community needs more
      if (need === "hunger" && collectiveState.foodPerCapita < 5) {
        modifier = 0.8; // Lower threshold = more tolerant
      }
      if (need === "thirst" && collectiveState.waterPerCapita < 8) {
        modifier = 0.85;
      }
      break;

    case "builder":
      // Builders are more tolerant of energy depletion when building
      if (need === "energy") {
        modifier = 0.85;
      }
      break;

    case "guard":
      // Guards need to stay more alert, less tolerant of low energy
      if (need === "energy") {
        modifier = 1.2; // Higher threshold = less tolerant
      }
      break;

    case "hunter":
      // Hunters need energy for chasing prey
      if (need === "energy") {
        modifier = 1.15;
      }
      if (need === "hunger") {
        modifier = 0.9; // More tolerant of hunger
      }
      break;
  }

  // Community prosperity bonus: when things are good, agents are more relaxed
  if (collectiveState.stockpileFillRatio > 0.7) {
    modifier *= 0.95;
  }

  return Math.max(10, Math.min(60, baseThreshold * modifier));
}

export {
  DEFAULT_COLLECTIVE_THRESHOLDS,
  ROLE_COLLECTIVE_MODIFIERS,
  CollectiveThresholds,
};
