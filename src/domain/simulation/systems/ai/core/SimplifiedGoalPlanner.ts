/**
 * SimplifiedGoalPlanner - Reemplazo de AgentGoalPlanner usando sistema de reglas
 *
 * Reduce ~4,000 líneas de evaluadores a ~50 líneas de integración.
 */

import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import type { GameState } from "../../../../types/game-types";
import type { Inventory } from "../../../../types/simulation/economy";
import type { GoalContext, GoalRule } from "./GoalRule";
import { evaluateRules } from "./GoalRule";
import { coreRules, fullRules } from "./GoalRules";

/**
 * Dependencias simplificadas - UNA sola interfaz en lugar de 18
 */
export interface SimplifiedGoalPlannerDeps {
  gameState: GameState;
  getEntityNeeds: (entityId: string) => EntityNeedsData | undefined;
  getAgentInventory?: (entityId: string) => Inventory | undefined;
  getEntityPosition?: (
    entityId: string,
  ) => { x: number; y: number } | undefined;
  getAgentRole?: (entityId: string) => { roleType: string } | undefined;

  // Extended context for fullRules
  getEnemies?: (entityId: string) => string[] | undefined;
  getNearbyPredators?: (
    entityId: string,
  ) => Array<{ id: string; position: { x: number; y: number } }> | undefined;
  isWarrior?: (entityId: string) => boolean;
  getEntityStats?: (entityId: string) => Record<string, number> | null;
  getBuildTasks?: (
    entityId: string,
  ) => Array<{ id: string; zoneId: string; score: number }> | undefined;
  getDepositZone?: (entityId: string) => string | undefined;
  getEquippedWeapon?: (entityId: string) => string | undefined;
  canCraftWeapon?: (
    entityId: string,
    weaponId: string,
  ) => boolean;
  getCraftZone?: () => string | undefined;
  hasAvailableWeapons?: () => boolean;

  // Assist context
  getNearbyAgentInNeed?: (entityId: string) => {
    id: string;
    need: "water" | "food" | "medical" | "rest" | "social";
    distance: number;
    targetZoneId?: string;
  } | undefined;

  // Trade context
  hasExcessResources?: (entityId: string) => boolean;
  getNearestMarketZoneId?: (entityId: string) => string | undefined;

  // Opportunities context
  getPreferredResource?: (entityId: string) => string | undefined;
  getNearestPreferredResource?: (entityId: string) => {
    id: string;
    x: number;
    y: number;
  } | undefined;
  getRoleEfficiency?: (entityId: string) => number;

  // Attention context
  getNearbyInspectable?: (entityId: string) => {
    id: string;
    position: { x: number; y: number };
  } | undefined;

  // Quest context
  getActiveQuestGoal?: (entityId: string) => {
    questId: string;
    objectiveId: string;
    goalType: string;
    targetZoneId?: string;
  } | undefined;

  // Building contribution context
  getContributableBuilding?: (entityId: string) => {
    zoneId: string;
    score: number;
  } | undefined;
}

/**
 * Planifica goals usando sistema de reglas declarativo.
 *
 * @param deps - Dependencias simplificadas
 * @param aiState - Estado del agente
 * @param now - Timestamp actual
 * @param maxGoals - Máximo de goals a retornar
 * @param rules - Reglas a usar (default: coreRules)
 */
export function planGoalsSimplified(
  deps: SimplifiedGoalPlannerDeps,
  aiState: AIState,
  now: number,
  maxGoals = 5,
  rules: GoalRule[] = coreRules,
): AIGoal[] {
  const entityId = aiState.entityId;
  const inventory = deps.getAgentInventory?.(entityId);

  // Construir contexto unificado
  const ctx: GoalContext = {
    entityId,
    aiState,
    now,
    needs: deps.getEntityNeeds(entityId),
    inventory,
    position: deps.getEntityPosition?.(entityId),
    roleType: deps.getAgentRole?.(entityId)?.roleType,
    gameState: deps.gameState,

    // Combat context
    enemies: deps.getEnemies?.(entityId),
    nearbyPredators: deps.getNearbyPredators?.(entityId),
    isWarrior: deps.isWarrior?.(entityId),
    stats: deps.getEntityStats?.(entityId),
    getEntityPosition: (id: string) => deps.getEntityPosition?.(id) ?? null,

    // Construction context
    buildTasks: deps.getBuildTasks?.(entityId),

    // Deposit context
    inventoryLoad: inventory
      ? (inventory.wood ?? 0) +
        (inventory.stone ?? 0) +
        (inventory.food ?? 0) +
        (inventory.water ?? 0)
      : 0,
    inventoryCapacity: inventory?.capacity ?? 50,
    hasWater: (inventory?.water ?? 0) > 0,
    hasFood: (inventory?.food ?? 0) > 0,
    depositZoneId: deps.getDepositZone?.(entityId),

    // Crafting context
    equippedWeapon: deps.getEquippedWeapon?.(entityId),
    canCraftClub: deps.canCraftWeapon?.(entityId, "wooden_club") ?? false,
    canCraftDagger: deps.canCraftWeapon?.(entityId, "stone_dagger") ?? false,
    craftZoneId: deps.getCraftZone?.(),
    hasAvailableWeapons: deps.hasAvailableWeapons?.() ?? false,

    // Assist context
    nearbyAgentInNeed: deps.getNearbyAgentInNeed?.(entityId),

    // Trade context
    hasExcessResources: deps.hasExcessResources?.(entityId) ?? false,
    nearestMarketZoneId: deps.getNearestMarketZoneId?.(entityId),

    // Opportunities context
    preferredResource: deps.getPreferredResource?.(entityId),
    nearestPreferredResource: deps.getNearestPreferredResource?.(entityId),
    roleEfficiency: deps.getRoleEfficiency?.(entityId) ?? 1.0,

    // Attention context
    nearbyInspectable: deps.getNearbyInspectable?.(entityId),

    // Quest context
    activeQuestGoal: deps.getActiveQuestGoal?.(entityId),

    // Building contribution context
    contributableBuilding: deps.getContributableBuilding?.(entityId),
  };

  // Evaluar todas las reglas y retornar goals priorizados
  return evaluateRules(rules, ctx, maxGoals);
}

/**
 * Versión completa que usa fullRules (incluye combat, construction, deposit, craft)
 */
export function planGoalsFull(
  deps: SimplifiedGoalPlannerDeps,
  aiState: AIState,
  now: number,
  maxGoals = 5,
): AIGoal[] {
  return planGoalsSimplified(deps, aiState, now, maxGoals, fullRules);
}
