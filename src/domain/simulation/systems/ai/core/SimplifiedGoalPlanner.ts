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
  canCraftWeapon?: (entityId: string, weaponId: string) => boolean;
  getCraftZone?: () => string | undefined;
  hasAvailableWeapons?: () => boolean;

  getNearbyAgentInNeed?: (entityId: string) =>
    | {
        id: string;
        need: "water" | "food" | "medical" | "rest" | "social";
        distance: number;
        targetZoneId?: string;
      }
    | undefined;

  hasExcessResources?: (entityId: string) => boolean;
  getNearestMarketZoneId?: (entityId: string) => string | undefined;

  getPreferredResource?: (entityId: string) => string | undefined;
  getNearestPreferredResource?: (entityId: string) =>
    | {
        id: string;
        x: number;
        y: number;
      }
    | undefined;
  getRoleEfficiency?: (entityId: string) => number;

  getNearbyInspectable?: (entityId: string) =>
    | {
        id: string;
        position: { x: number; y: number };
      }
    | undefined;

  getActiveQuestGoal?: (entityId: string) =>
    | {
        questId: string;
        objectiveId: string;
        goalType: string;
        targetZoneId?: string;
      }
    | undefined;

  getContributableBuilding?: (entityId: string) =>
    | {
        zoneId: string;
        score: number;
      }
    | undefined;
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

  const ctx: GoalContext = {
    entityId,
    aiState,
    now,
    needs: deps.getEntityNeeds(entityId),
    inventory,
    position: deps.getEntityPosition?.(entityId),
    roleType: deps.getAgentRole?.(entityId)?.roleType,
    gameState: deps.gameState,

    enemies: deps.getEnemies?.(entityId),
    nearbyPredators: deps.getNearbyPredators?.(entityId),
    isWarrior: deps.isWarrior?.(entityId),
    stats: deps.getEntityStats?.(entityId),
    getEntityPosition: (id: string) => deps.getEntityPosition?.(id) ?? null,

    buildTasks: deps.getBuildTasks?.(entityId),

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

    equippedWeapon: deps.getEquippedWeapon?.(entityId),
    canCraftClub: deps.canCraftWeapon?.(entityId, "wooden_club") ?? false,
    canCraftDagger: deps.canCraftWeapon?.(entityId, "stone_dagger") ?? false,
    craftZoneId: deps.getCraftZone?.(),
    hasAvailableWeapons: deps.hasAvailableWeapons?.() ?? false,

    nearbyAgentInNeed: deps.getNearbyAgentInNeed?.(entityId),

    hasExcessResources: deps.hasExcessResources?.(entityId) ?? false,
    nearestMarketZoneId: deps.getNearestMarketZoneId?.(entityId),

    preferredResource: deps.getPreferredResource?.(entityId),
    nearestPreferredResource: deps.getNearestPreferredResource?.(entityId),
    roleEfficiency: deps.getRoleEfficiency?.(entityId) ?? 1.0,

    nearbyInspectable: deps.getNearbyInspectable?.(entityId),

    activeQuestGoal: deps.getActiveQuestGoal?.(entityId),

    contributableBuilding: deps.getContributableBuilding?.(entityId),
  };

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
