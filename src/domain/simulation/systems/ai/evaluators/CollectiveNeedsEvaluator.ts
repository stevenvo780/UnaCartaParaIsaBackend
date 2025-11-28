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
import type {
  Task,
  TaskCreationParams,
} from "../../../../types/simulation/tasks";
import {
  GoalType as GoalTypeEnum,
  NeedType,
} from "../../../../../shared/constants/AIEnums";
import { ResourceType as ResourceTypeEnum } from "../../../../../shared/constants/ResourceEnums";
import { RoleType as RoleTypeEnum } from "../../../../../shared/constants/RoleEnums";
import { TaskType } from "../../../../../shared/constants/TaskEnums";
import { DemandType } from "../../../../../shared/constants/GovernanceEnums";

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
  [RoleTypeEnum.LOGGER]: {
    gatherPriority: 1.3,
    buildPriority: 0.8,
    depositPriority: 1.2,
    preferredResource: ResourceTypeEnum.WOOD,
  },
  [RoleTypeEnum.QUARRYMAN]: {
    gatherPriority: 1.3,
    buildPriority: 0.8,
    depositPriority: 1.2,
    preferredResource: ResourceTypeEnum.STONE,
  },
  [RoleTypeEnum.MINER]: {
    gatherPriority: 1.4,
    buildPriority: 0.7,
    depositPriority: 1.3,
    preferredResource: ResourceTypeEnum.METAL,
  },
  [RoleTypeEnum.BUILDER]: {
    gatherPriority: 0.9,
    buildPriority: 1.5,
    depositPriority: 1.0,
  },
  [RoleTypeEnum.FARMER]: {
    gatherPriority: 1.2,
    buildPriority: 0.7,
    depositPriority: 1.1,
    preferredResource: ResourceTypeEnum.FOOD,
  },
  [RoleTypeEnum.GATHERER]: {
    gatherPriority: 1.4,
    buildPriority: 0.6,
    depositPriority: 1.3,
    preferredResource: ResourceTypeEnum.WATER,
  },
  [RoleTypeEnum.GUARD]: {
    gatherPriority: 0.5,
    buildPriority: 0.7,
    depositPriority: 0.8,
  },
  [RoleTypeEnum.HUNTER]: {
    gatherPriority: 1.1,
    buildPriority: 0.6,
    depositPriority: 1.0,
    preferredResource: ResourceTypeEnum.FOOD,
  },
  [RoleTypeEnum.CRAFTSMAN]: {
    gatherPriority: 0.8,
    buildPriority: 1.2,
    depositPriority: 1.1,
  },
  [RoleTypeEnum.LEADER]: {
    gatherPriority: 0.6,
    buildPriority: 0.8,
    depositPriority: 0.9,
  },
  [RoleTypeEnum.IDLE]: {
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
  taskSystem?: {
    createTask: (params: TaskCreationParams) => Task | null;
    getAvailableCommunityTasks: () => Task[];
    claimTask: (taskId: string, agentId: string) => boolean;
  };
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

  if (state.foodPerCapita < thresholds.foodPerCapita) {
    const urgency = 1 - state.foodPerCapita / thresholds.foodPerCapita;
    needs.push({
      resource: ResourceTypeEnum.FOOD,
      urgency: Math.min(1, urgency * 1.5),
    });
  }

  if (state.waterPerCapita < thresholds.waterPerCapita) {
    const urgency = 1 - state.waterPerCapita / thresholds.waterPerCapita;
    needs.push({
      resource: ResourceTypeEnum.WATER,
      urgency: Math.min(1, urgency * 1.3),
    });
  }

  if (state.totalWood < thresholds.minWoodReserve) {
    const urgency = 1 - state.totalWood / thresholds.minWoodReserve;
    needs.push({
      resource: ResourceTypeEnum.WOOD,
      urgency: Math.min(1, urgency),
    });
  }

  if (state.totalStone < thresholds.minStoneReserve) {
    const urgency = 1 - state.totalStone / thresholds.minStoneReserve;
    needs.push({
      resource: ResourceTypeEnum.STONE,
      urgency: Math.min(1, urgency * 0.9),
    });
  }

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

  const foodDemand = state.activeDemands.find(
    (d) => d.type === DemandType.FOOD_SHORTAGE && !d.resolvedAt,
  );
  const waterDemand = state.activeDemands.find(
    (d) => d.type === DemandType.WATER_SHORTAGE && !d.resolvedAt,
  );
  const housingDemand = state.activeDemands.find(
    (d) => d.type === DemandType.HOUSING_FULL && !d.resolvedAt,
  );

  if (ctx.taskSystem) {
    const availableTasks = ctx.taskSystem.getAvailableCommunityTasks();

    for (const task of availableTasks) {
      const taskUrgency = (task.metadata?.urgency as number) || 0.5;
      const taskResourceType = task.metadata?.resourceType as string;

      if (modifiers.preferredResource) {
        if (
          taskResourceType &&
          taskResourceType !== modifiers.preferredResource
        ) {
          continue;
        }
      }

      let priority = 0.5 + taskUrgency * 0.3;

      if (modifiers.preferredResource === taskResourceType) {
        priority += 0.15;
      }

      if (
        (taskResourceType === ResourceTypeEnum.FOOD && foodDemand) ||
        (taskResourceType === ResourceTypeEnum.WATER && waterDemand)
      ) {
        priority += 0.1;
      }

      priority *= modifiers.gatherPriority;
      priority = Math.min(0.85, Math.max(0.3, priority));

      goals.push({
        id: `join_community_task_${task.id}_${now}`,
        type: GoalTypeEnum.WORK,
        priority,
        data: {
          taskId: task.id,
          communityTask: true,
          taskType: task.type,
          resourceType: taskResourceType as ResourceTypeEnum | undefined,
        },
        createdAt: now,
        expiresAt: now + 30000,
      });
    }
  }

  const mostNeeded = getMostNeededResource(state, thresholds);

  if (mostNeeded && ctx.taskSystem) {
    const existingTask = ctx.taskSystem
      .getAvailableCommunityTasks()
      .find(
        (t) => (t.metadata?.resourceType as string) === mostNeeded.resource,
      );

    if (!existingTask) {
      const workersNeeded = Math.ceil(state.population * 0.15);
      const taskType = getTaskTypeForResource(mostNeeded.resource);

      const newTask = ctx.taskSystem.createTask({
        type: taskType,
        requiredWork: 100,
        metadata: {
          communityTask: true,
          urgency: mostNeeded.urgency,
          resourceType: mostNeeded.resource,
          maxClaims: workersNeeded,
          priority: 0.7 + mostNeeded.urgency * 0.2,
        },
      });

      if (newTask) {
        let basePriority = 0.4 + mostNeeded.urgency * 0.35;

        if (
          (mostNeeded.resource === ResourceTypeEnum.FOOD && foodDemand) ||
          (mostNeeded.resource === ResourceTypeEnum.WATER && waterDemand)
        ) {
          basePriority += 0.2;
        }

        let finalPriority = basePriority * modifiers.gatherPriority;

        if (modifiers.preferredResource === mostNeeded.resource) {
          finalPriority += 0.15;
        }

        finalPriority += aiState.personality.diligence * 0.1;
        finalPriority += aiState.personality.conscientiousness * 0.05;

        finalPriority = Math.min(0.85, Math.max(0.3, finalPriority));

        goals.push({
          id: `new_community_task_${newTask.id}_${now}`,
          type: GoalTypeEnum.WORK,
          priority: finalPriority,
          data: {
            taskId: newTask.id,
            communityTask: true,
            resourceType: mostNeeded.resource,
          },
          createdAt: now,
          expiresAt: now + 30000,
        });
      }
    }
  }

  if (!ctx.taskSystem && mostNeeded) {
    let basePriority = 0.4 + mostNeeded.urgency * 0.35;

    if (
      (mostNeeded.resource === ResourceTypeEnum.FOOD && foodDemand) ||
      (mostNeeded.resource === ResourceTypeEnum.WATER && waterDemand)
    ) {
      basePriority += 0.2;
    }

    let finalPriority = basePriority * modifiers.gatherPriority;

    if (modifiers.preferredResource === mostNeeded.resource) {
      finalPriority += 0.15;
    }

    finalPriority += aiState.personality.diligence * 0.1;
    finalPriority += aiState.personality.conscientiousness * 0.05;

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
        settlementNeed: mostNeeded.resource as string,
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  if (inventory) {
    const agentLoad =
      (inventory.wood || 0) +
      (inventory.stone || 0) +
      (inventory.food || 0) +
      (inventory.water || 0);
    const agentCapacity = inventory.capacity || 50;
    const loadRatio = agentLoad / agentCapacity;

    const depositThreshold =
      state.stockpileFillRatio < thresholds.stockpileFillTarget ? 0.3 : 0.6;

    if (loadRatio > depositThreshold && agentLoad > 5) {
      let depositPriority = 0.5 + (loadRatio - depositThreshold) * 0.4;
      depositPriority *= modifiers.depositPriority;

      if (state.stockpileFillRatio < 0.3) {
        depositPriority += 0.2;
      }

      depositPriority = Math.min(0.8, Math.max(0.4, depositPriority));

      goals.push({
        id: `collective_deposit_${now}`,
        type: GoalTypeEnum.DEPOSIT,
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

  if (state.stockpileFillRatio > thresholds.storageExpansionThreshold) {
    let buildPriority =
      0.5 +
      (state.stockpileFillRatio - thresholds.storageExpansionThreshold) * 2;
    buildPriority *= modifiers.buildPriority;

    if (roleType === RoleTypeEnum.BUILDER) {
      buildPriority += 0.2;
    }

    if (housingDemand) {
      buildPriority += 0.1;
    }

    buildPriority = Math.min(0.75, Math.max(0.4, buildPriority));

    goals.push({
      id: `collective_build_storage_${now}`,
      type: GoalTypeEnum.CONSTRUCTION,
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

  if (goals.length === 0 && state.stockpileFillRatio < 0.5 && inventory) {
    const prosperityPriority = 0.35 + aiState.personality.diligence * 0.15;

    const lowestResource = getLowestResource(state);

    goals.push({
      id: `prosperity_gather_${lowestResource}_${now}`,
      type: GoalTypeEnum.GATHER,
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
    case ResourceTypeEnum.FOOD:
      return GoalTypeEnum.GATHER;
    case ResourceTypeEnum.WATER:
      return GoalTypeEnum.GATHER;
    case ResourceTypeEnum.WOOD:
      return GoalTypeEnum.WORK;
    case ResourceTypeEnum.STONE:
      return GoalTypeEnum.WORK;
    default:
      return GoalTypeEnum.GATHER;
  }
}

/**
 * Returns the resource type with the lowest reserves relative to need.
 */
function getLowestResource(state: CollectiveNeedsState): ResourceType {
  const ratios = [
    {
      resource: ResourceTypeEnum.FOOD,
      ratio: state.foodPerCapita / 10,
    },
    {
      resource: ResourceTypeEnum.WATER,
      ratio: state.waterPerCapita / 15,
    },
    { resource: ResourceTypeEnum.WOOD, ratio: state.totalWood / 100 },
    { resource: ResourceTypeEnum.STONE, ratio: state.totalStone / 50 },
  ];

  ratios.sort((a, b) => a.ratio - b.ratio);
  return ratios[0].resource;
}

/**
 * Returns the task type for gathering a specific resource.
 */
function getTaskTypeForResource(resource: ResourceType): TaskType {
  switch (resource) {
    case ResourceTypeEnum.FOOD:
      return TaskType.GATHER_FOOD;
    case ResourceTypeEnum.WATER:
      return TaskType.GATHER_WATER;
    case ResourceTypeEnum.WOOD:
      return TaskType.GATHER_WOOD;
    case ResourceTypeEnum.STONE:
      return TaskType.GATHER_STONE;
    case ResourceTypeEnum.METAL:
    case ResourceTypeEnum.IRON_ORE:
    case ResourceTypeEnum.COPPER_ORE:
      return TaskType.GATHER_METAL;
    default:
      return TaskType.CUSTOM;
  }
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

  switch (roleType) {
    case RoleTypeEnum.FARMER:
    case RoleTypeEnum.GATHERER:
      if (need === NeedType.HUNGER && collectiveState.foodPerCapita < 5) {
        modifier = 0.8;
      }
      if (need === NeedType.THIRST && collectiveState.waterPerCapita < 8) {
        modifier = 0.85;
      }
      break;

    case RoleTypeEnum.BUILDER:
      if (need === NeedType.ENERGY) {
        modifier = 0.85;
      }
      break;

    case RoleTypeEnum.GUARD:
      if (need === "energy") {
        modifier = 1.2;
      }
      break;

    case RoleTypeEnum.HUNTER:
      if (need === "energy") {
        modifier = 1.15;
      }
      if (need === NeedType.HUNGER) {
        modifier = 0.9;
      }
      break;
  }

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
