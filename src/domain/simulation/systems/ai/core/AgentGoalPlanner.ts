import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AIState } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import type { AgentRole } from "../../../../types/simulation/roles";
import type {
  Task,
  TaskCreationParams,
} from "../../../../types/simulation/tasks";
import type {
  Inventory,
  Stockpile,
} from "../../../../types/simulation/economy";
import type { SettlementDemand } from "../../../../types/simulation/governance";
import type { PriorityManager } from "./PriorityManager";
import { evaluateCriticalNeeds } from "../evaluators/NeedsEvaluator";
import {
  evaluateWorkOpportunities,
  evaluateExplorationOpportunities,
} from "../evaluators/OpportunitiesEvaluator";
import { evaluateAssist } from "../evaluators/AssistEvaluator";
import { evaluateCombatGoals } from "../evaluators/CombatEvaluator";
import { evaluateConstructionGoals } from "../evaluators/ConstructionEvaluator";
import { evaluateDepositGoals } from "../evaluators/DepositEvaluator";
import { evaluateCrafting } from "../evaluators/CraftingEvaluator";
import {
  evaluateAttention,
  evaluateDefaultExploration,
} from "../evaluators/AttentionEvaluator";
import { evaluateQuestGoals } from "../evaluators/QuestEvaluator";
import { evaluateTradeGoals } from "../evaluators/TradeEvaluator";
import { evaluateBuildingContributionGoals } from "../evaluators/BuildingContributionEvaluator";
import {
  evaluateCollectiveNeeds,
  type CollectiveNeedsContext,
} from "../evaluators/CollectiveNeedsEvaluator";
import {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getEntityPosition,
} from "./utils";
import type { Quest } from "../../../../types/simulation/quests";
import { evaluateExpansionGoals } from "../evaluators/ExpansionEvaluator";

/**
 * Dependencies interface for goal planning.
 * Provides all necessary functions and data for evaluating and selecting goals.
 */
export interface AgentGoalPlannerDeps {
  gameState: GameState;
  priorityManager: PriorityManager;
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  findNearestHuntableAnimal?: (
    entityId: string,
  ) => { id: string; x: number; y: number; type: string } | null;
  getAgentRole?: (agentId: string) => AgentRole | undefined;
  getPreferredResourceForRole?: (roleType: string) => string | undefined;

  getTasks?: () => Task[];
  taskSystem?: {
    createTask: (params: TaskCreationParams) => Task | null;
    getAvailableCommunityTasks: () => Task[];
    claimTask: (taskId: string, agentId: string) => boolean;
    releaseTaskClaim: (taskId: string, agentId: string) => void;
  };
  sharedKnowledgeSystem?: {
    getKnownResourceAlerts: (agentId: string) => Array<{
      id: string;
      resourceId: string;
      resourceType: string;
      position: { x: number; y: number };
    }>;
    getKnownThreatAlerts: (agentId: string) => Array<{
      id: string;
      threatId: string;
      threatType: "predator" | "hostile_agent" | "danger_zone";
      position: { x: number; y: number };
      severity: number;
    }>;
  };
  getAgentInventory?: (id: string) => Inventory | undefined;
  getCurrentZone?: (id: string) => string | undefined;
  getEquipped?: (id: string) => string;
  getSuggestedCraftZone?: () => string | undefined;
  canCraftWeapon?: (id: string, weaponId: string) => boolean;
  getAllActiveAgentIds?: () => string[];
  getEntityStats?: (id: string) => Record<string, number> | null;
  getStrategy?: (id: string) => "peaceful" | "tit_for_tat" | "bully";
  isWarrior?: (id: string) => boolean;
  getEnemiesForAgent?: (id: string, threshold?: number) => string[];
  getNearbyPredators?: (
    pos: { x: number; y: number },
    range: number,
  ) => Array<{ id: string; position: { x: number; y: number } }>;
  getActiveQuests?: () => Quest[];
  getAvailableQuests?: () => Quest[];
  getCurrentTimeOfDay?: () =>
    | "dawn"
    | "morning"
    | "midday"
    | "afternoon"
    | "dusk"
    | "night"
    | "deep_night";
  getEntityPosition?: (id: string) => { x: number; y: number } | null;
  getNearbyAgentsWithDistances?: (
    entityId: string,
    radius: number,
  ) => Array<{ id: string; distance: number }>;

  getAllStockpiles?: () => Stockpile[];
  getActiveDemands?: () => SettlementDemand[];
  getPopulation?: () => number;
  /** Gets collective resource state for threshold adjustments */
  getCollectiveResourceState?: () => {
    foodPerCapita: number;
    waterPerCapita: number;
    stockpileFillRatio: number;
  } | null;
}

/**
 * Plans goals for an agent based on current state and available opportunities.
 *
 * Evaluates multiple goal categories:
 * - Critical needs (hunger, thirst, energy)
 * - Collective/community needs (stockpile filling, resource shortages)
 * - Combat and defense
 * - Assistance to other agents
 * - Construction and building
 * - Resource gathering and deposit
 * - Crafting
 * - Work opportunities
 * - Exploration
 * - Quests
 * - Trade
 *
 * Goals are prioritized and sorted by importance.
 *
 * @param deps - Dependencies providing game state and query functions
 * @param aiState - Current AI state of the agent
 * @param minPriority - Minimum priority threshold for goals (default: 0.3)
 * @returns Array of goals sorted by priority (highest first)
 */
export function planGoals(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  now: number,
  minPriority: number = 0.3,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);
  const positionFor = (id: string): { x: number; y: number } =>
    getEntityPosition(id, deps.gameState) ?? { x: 0, y: 0 };
  const defaultStats = (): Record<string, number> | null => null;
  const selectZone = (
    state: AIState,
    ids: string[],
    type: string,
  ): string | null =>
    selectBestZone(state, ids, type, deps.gameState, positionFor);
  const zoneIdsByType = (types: string[]): string[] =>
    deps.gameState.zones
      ?.filter((z) => types.includes(z.type))
      .map((z) => z.id) || [];

  if (entityNeeds) {
    const needsDeps = {
      getEntityNeeds: deps.getEntityNeeds,
      getAgentInventory: deps.getAgentInventory,
      findNearestResource: deps.findNearestResource,
      findNearestHuntableAnimal: deps.findNearestHuntableAnimal,
      getCurrentTimeOfDay: deps.getCurrentTimeOfDay,
      getAgentRole: deps.getAgentRole
        ? (id: string): { roleType: string } | undefined => {
            const role = deps.getAgentRole!(id);
            return role ? { roleType: role.roleType } : undefined;
          }
        : undefined,
      getCollectiveResourceState: deps.getCollectiveResourceState,
    };
    const criticalGoals = evaluateCriticalNeeds(needsDeps, aiState);
    goals.push(...criticalGoals);

    const criticalSurvivalGoal = criticalGoals.find((g) => g.priority > 0.8);
    if (criticalSurvivalGoal) {
      return [criticalSurvivalGoal];
    }
  }

  if (deps.getAgentInventory && deps.getAllStockpiles && deps.getPopulation) {
    const collectiveDeps: CollectiveNeedsContext = {
      gameState: deps.gameState,
      getAgentInventory: deps.getAgentInventory,
      getAgentRole: deps.getAgentRole
        ? (id: string): { roleType: string } | undefined => {
            const role = deps.getAgentRole!(id);
            return role ? { roleType: role.roleType } : undefined;
          }
        : (): undefined => undefined,
      getEntityPosition: positionFor,
      getAllStockpiles: () =>
        deps.getAllStockpiles!().map((sp) => ({
          id: sp.id,
          zoneId: sp.zoneId,
          inventory: sp.inventory,
          capacity: sp.capacity,
        })),
      getActiveDemands: deps.getActiveDemands,
      getPopulation: deps.getPopulation,
      taskSystem: deps.taskSystem,
    };
    const collectiveGoals = evaluateCollectiveNeeds(
      collectiveDeps,
      aiState,
      now,
    );
    goals.push(...collectiveGoals);
  }

  if (
    deps.getStrategy &&
    deps.isWarrior &&
    deps.getEnemiesForAgent &&
    deps.getNearbyPredators
  ) {
    const combatDeps = {
      getEntityPosition: positionFor,
      getEntityStats: deps.getEntityStats ?? defaultStats,
      getStrategy: deps.getStrategy,
      isWarrior: deps.isWarrior,
      getEnemiesForAgent: deps.getEnemiesForAgent,
      getNearbyPredators: deps.getNearbyPredators,
    };
    const combatGoals = evaluateCombatGoals(combatDeps, aiState);
    goals.push(...combatGoals);

    const combatGoal = combatGoals.find((g) => g.priority > 0.7);
    if (combatGoal) {
      return [combatGoal];
    }
  }

  if (deps.getAllActiveAgentIds && deps.getEntityStats) {
    const assistDeps = {
      getAllActiveAgentIds: deps.getAllActiveAgentIds,
      getEntityPosition: positionFor,
      getNeeds: deps.getEntityNeeds,
      getEntityStats: deps.getEntityStats,
      selectBestZone: selectZone,
      getZoneIdsByType: zoneIdsByType,
      getNearbyAgentsWithDistances: deps.getNearbyAgentsWithDistances,
    };
    const assistGoals = evaluateAssist(assistDeps, aiState);
    goals.push(...assistGoals);
  }

  if (deps.getTasks) {
    const constDeps = {
      gameState: deps.gameState,
      getEntityPosition: positionFor,
      getTasks: deps.getTasks,
    };
    const constructionGoals = evaluateConstructionGoals(constDeps, aiState);
    goals.push(...constructionGoals);
  }

  if (deps.getAgentInventory && deps.getCurrentZone) {
    const depositDeps = {
      gameState: deps.gameState,
      getAgentInventory: deps.getAgentInventory,
      getCurrentZone: deps.getCurrentZone,
      selectBestZone: selectZone,
    };
    const depositGoals = evaluateDepositGoals(depositDeps, aiState);
    goals.push(...depositGoals);
  }

  if (deps.getEquipped && deps.getSuggestedCraftZone && deps.canCraftWeapon) {
    const craftingDeps = {
      getEquipped: deps.getEquipped,
      getSuggestedCraftZone: deps.getSuggestedCraftZone,
      canCraftWeapon: deps.canCraftWeapon,
    };
    const craftingGoals = evaluateCrafting(craftingDeps, aiState);
    goals.push(...craftingGoals);
  }

  if (deps.getActiveQuests && deps.getAvailableQuests) {
    const questDeps = {
      getActiveQuests: deps.getActiveQuests,
      getAvailableQuests: deps.getAvailableQuests,
      getEntityPosition: positionFor,
    };
    const questGoals = evaluateQuestGoals(questDeps, aiState);
    goals.push(...questGoals);
  }

  if (deps.getAgentInventory && deps.getAllActiveAgentIds) {
    const tradeDeps = {
      getAgentInventory: deps.getAgentInventory,
      getEntityPosition: positionFor,
      getAllActiveAgentIds: deps.getAllActiveAgentIds,
      gameState: deps.gameState,
    };
    const tradeGoals = evaluateTradeGoals(tradeDeps, aiState);
    goals.push(...tradeGoals);
  }

  if (deps.getAgentInventory && deps.getEntityPosition) {
    const buildingDeps = {
      gameState: deps.gameState,
      getEntityPosition: positionFor,
      getAgentInventory: deps.getAgentInventory,
    };
    const buildingGoals = evaluateBuildingContributionGoals(
      buildingDeps,
      aiState,
    );
    goals.push(...buildingGoals);
  }

  const attentionDeps = {
    gameState: deps.gameState,
    getEntityPosition: positionFor,
    selectBestZone: selectZone,
  };
  const attentionGoals = evaluateAttention(attentionDeps, aiState);
  goals.push(...attentionGoals);

  const criticalCount = goals.filter((g) => g.priority > 0.7).length;

  if (criticalCount === 0) {
    if (deps.getAgentRole && deps.getPreferredResourceForRole) {
      const oppDeps = {
        getAgentRole: deps.getAgentRole,
        getPreferredResourceForRole: (role: string): string | null =>
          deps.getPreferredResourceForRole!(role) || null,
        findNearestResource: deps.findNearestResource,
        getCurrentTimeOfDay: deps.getCurrentTimeOfDay,
      };
      const workGoals = evaluateWorkOpportunities(oppDeps, aiState);
      goals.push(...workGoals);
    }

    const opportunityGoals = evaluateExplorationOpportunities(
      {
        gameState: deps.gameState,
        getUnexploredZones,
        selectBestZone,
        getEntityPosition: positionFor,
      },
      aiState,
    );
    goals.push(...opportunityGoals);
  }

  if (deps.getAgentInventory && deps.getEntityPosition) {
    const expansionDeps = {
      gameState: deps.gameState,
      getAgentInventory: deps.getAgentInventory,
      getEntityPosition: positionFor,
    };
    const expansionGoals = evaluateExpansionGoals(expansionDeps, aiState, now);
    goals.push(...expansionGoals);
  }

  if (goals.length === 0) {
    const defaultDeps = {
      gameState: deps.gameState,
      getEntityPosition: positionFor,
      selectBestZone: selectZone,
    };
    const defaultGoals = evaluateDefaultExploration(defaultDeps, aiState);
    goals.push(...defaultGoals);
  }

  const prioritized = prioritizeGoals(
    goals,
    aiState,
    deps.priorityManager,
    minPriority,
    0.1, // Small softmax tau for exploration
  );

  return prioritized.slice(0, 5); // Return top 5 goals
}
