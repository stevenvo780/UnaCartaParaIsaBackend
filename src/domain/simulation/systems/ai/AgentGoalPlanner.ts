import type { GameState } from "../../../types/game-types";
import type { AIGoal, AIState } from "../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { AgentRole } from "../../../types/simulation/roles";
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
import {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getEntityPosition,
} from "./utils";

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

  // New dependencies for full AI cycle
  getTasks?: () => any[];
  getAgentInventory?: (id: string) => any;
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
}

export function planGoals(
  deps: AgentGoalPlannerDeps,
  aiState: AIState,
  minPriority: number = 0.3,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const entityNeeds = deps.getEntityNeeds(aiState.entityId);

  // 1. Critical Needs
  if (entityNeeds) {
    const needsDeps = {
      getEntityNeeds: deps.getEntityNeeds,
      findNearestResource: deps.findNearestResource,
    };
    const criticalGoals = evaluateCriticalNeeds(needsDeps, aiState);
    goals.push(...criticalGoals);
  }

  // 2. Combat / Threats
  if (
    deps.getStrategy &&
    deps.isWarrior &&
    deps.getEnemiesForAgent &&
    deps.getNearbyPredators
  ) {
    const combatDeps = {
      getEntityPosition: (id: string) => getEntityPosition(id, deps.gameState),
      getEntityStats: deps.getEntityStats || (() => null),
      getStrategy: deps.getStrategy,
      isWarrior: deps.isWarrior,
      getEnemiesForAgent: deps.getEnemiesForAgent,
      getNearbyPredators: deps.getNearbyPredators,
    };
    const combatGoals = evaluateCombatGoals(combatDeps, aiState);
    goals.push(...combatGoals);
  }

  // 3. Assist (Social)
  if (deps.getAllActiveAgentIds && deps.getEntityStats) {
    const assistDeps = {
      getAllActiveAgentIds: deps.getAllActiveAgentIds,
      getEntityPosition: (id: string) => getEntityPosition(id, deps.gameState),
      getNeeds: deps.getEntityNeeds,
      getEntityStats: deps.getEntityStats,
      selectBestZone: (st: AIState, ids: string[], t: string) =>
        selectBestZone(st, ids, t, deps.gameState, (id) =>
          getEntityPosition(id, deps.gameState),
        ),
      getZoneIdsByType: (types: string[]) =>
        deps.gameState.zones
          ?.filter((z) => types.includes(z.type))
          .map((z) => z.id) || [],
    };
    const assistGoals = evaluateAssist(assistDeps, aiState);
    goals.push(...assistGoals);
  }

  // 4. Construction
  if (deps.getTasks) {
    const constDeps = {
      gameState: deps.gameState,
      getEntityPosition: (id: string) => getEntityPosition(id, deps.gameState),
      getTasks: deps.getTasks,
    };
    const constructionGoals = evaluateConstructionGoals(constDeps, aiState);
    goals.push(...constructionGoals);
  }

  // 5. Deposit
  if (deps.getAgentInventory && deps.getCurrentZone) {
    const depositDeps = {
      gameState: deps.gameState,
      getAgentInventory: deps.getAgentInventory,
      getCurrentZone: deps.getCurrentZone,
      selectBestZone: (st: AIState, ids: string[], t: string) =>
        selectBestZone(st, ids, t, deps.gameState, (id) =>
          getEntityPosition(id, deps.gameState),
        ),
    };
    const depositGoals = evaluateDepositGoals(depositDeps, aiState);
    goals.push(...depositGoals);
  }

  // 6. Crafting
  if (deps.getEquipped && deps.getSuggestedCraftZone && deps.canCraftWeapon) {
    const craftingDeps = {
      getEquipped: deps.getEquipped,
      getSuggestedCraftZone: deps.getSuggestedCraftZone,
      canCraftWeapon: deps.canCraftWeapon,
    };
    const craftingGoals = evaluateCrafting(craftingDeps, aiState);
    goals.push(...craftingGoals);
  }

  // 7. Attention / Inspection
  const attentionDeps = {
    gameState: deps.gameState,
    getEntityPosition: (id: string) => getEntityPosition(id, deps.gameState),
    selectBestZone: (st: AIState, ids: string[], t: string) =>
      selectBestZone(st, ids, t, deps.gameState, (id) =>
        getEntityPosition(id, deps.gameState),
      ),
  };
  const attentionGoals = evaluateAttention(attentionDeps, aiState);
  goals.push(...attentionGoals);

  // 8. Work Opportunities (if not critical)
  const criticalCount = goals.filter((g) => g.priority > 0.7).length;
  if (criticalCount === 0) {
    if (deps.getAgentRole && deps.getPreferredResourceForRole) {
      const oppDeps = {
        getAgentRole: deps.getAgentRole,
        getPreferredResourceForRole: (role: string) =>
          deps.getPreferredResourceForRole!(role) || null,
        findNearestResource: deps.findNearestResource,
      };
      const workGoals = evaluateWorkOpportunities(oppDeps, aiState);
      goals.push(...workGoals);
    }

    const opportunityGoals = evaluateExplorationOpportunities(
      {
        gameState: deps.gameState,
        getUnexploredZones,
        selectBestZone,
        getEntityPosition: (id) => getEntityPosition(id, deps.gameState),
      },
      aiState,
    );
    goals.push(...opportunityGoals);
  }

  // 9. Default Exploration (Fallback)
  if (goals.length === 0) {
    const defaultDeps = {
      gameState: deps.gameState,
      getEntityPosition: (id: string) => getEntityPosition(id, deps.gameState),
      selectBestZone: (st: AIState, ids: string[], t: string) =>
        selectBestZone(st, ids, t, deps.gameState, (id) =>
          getEntityPosition(id, deps.gameState),
        ),
    };
    const defaultGoals = evaluateDefaultExploration(defaultDeps, aiState);
    goals.push(...defaultGoals);
  }

  // Prioritize and filter
  const prioritized = prioritizeGoals(
    goals,
    aiState,
    deps.priorityManager,
    minPriority,
    0.1, // Small softmax tau for exploration
  );

  return prioritized.slice(0, 5); // Return top 5 goals
}
