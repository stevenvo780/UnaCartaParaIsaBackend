import type { GameState } from "../../../types/game-types";
import type { AIGoal, AIState } from "../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { AgentRole } from "../../../types/simulation/roles";
import type { Task } from "../../../types/simulation/tasks";
import type { Inventory } from "../../../types/simulation/economy";
import type { PriorityManager } from "./PriorityManager";
import { evaluateCriticalNeeds } from "./NeedsEvaluator";
import {
  evaluateWorkOpportunities,
  evaluateExplorationOpportunities,
} from "./OpportunitiesEvaluator";
import { evaluateAssist } from "./AssistEvaluator";
import { evaluateCombatGoals } from "./CombatEvaluator";
import { evaluateConstructionGoals } from "./ConstructionEvaluator";
import { evaluateDepositGoals } from "./DepositEvaluator";
import { evaluateCrafting } from "./CraftingEvaluator";
import {
  evaluateAttention,
  evaluateDefaultExploration,
} from "./AttentionEvaluator";
import { evaluateQuestGoals } from "./QuestEvaluator";
import { evaluateTradeGoals } from "./TradeEvaluator";
import { evaluateBuildingContributionGoals } from "./BuildingContributionEvaluator";
import {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getEntityPosition,
} from "./utils";
import type { Quest } from "../../../types/simulation/quests";

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
  getAgentRole?: (agentId: string) => AgentRole | undefined;
  getPreferredResourceForRole?: (roleType: string) => string | undefined;

  getTasks?: () => Task[];
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
}

/**
 * Plans goals for an agent based on current state and available opportunities.
 *
 * Evaluates multiple goal categories:
 * - Critical needs (hunger, thirst, energy)
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
      findNearestResource: deps.findNearestResource,
      getCurrentTimeOfDay: deps.getCurrentTimeOfDay,
    };
    const criticalGoals = evaluateCriticalNeeds(needsDeps, aiState);
    goals.push(...criticalGoals);
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
  }

  if (deps.getAllActiveAgentIds && deps.getEntityStats) {
    const assistDeps = {
      getAllActiveAgentIds: deps.getAllActiveAgentIds,
      getEntityPosition: positionFor,
      getNeeds: deps.getEntityNeeds,
      getEntityStats: deps.getEntityStats,
      selectBestZone: selectZone,
      getZoneIdsByType: zoneIdsByType,
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
