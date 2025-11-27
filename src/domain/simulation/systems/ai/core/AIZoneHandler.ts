import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AIState } from "../../../../types/simulation/ai";
import type { ResourceType } from "../../../../types/simulation/economy";
import { simulationEvents, GameEventNames } from "../../../core/events";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";
import { GoalType } from "../../../../../shared/constants/AIEnums";
import { ItemCategory } from "../../../../../shared/constants/ItemEnums";
import { logger } from "../../../../../infrastructure/utils/logger";
/**
 * Minimal interface for inventory operations needed by AIZoneHandler.
 */
export interface AIZoneInventoryPort {
  getAgentInventory(agentId: string): {
    wood: number;
    stone: number;
    food: number;
    water: number;
    metal?: number;
    rare_materials?: number;
  } | null;
  removeFromAgent(agentId: string, type: ResourceType, amount: number): void;
  addResource(agentId: string, type: ResourceType, amount: number): boolean;
  getStockpilesInZone(zoneId: string): Array<{ id: string }>;
  createStockpile(zoneId: string, type: string): { id: string };
  transferToStockpile(
    agentId: string,
    stockpileId: string,
    resources: {
      wood: number;
      stone: number;
      food: number;
      water: number;
      metal?: number;
      rare_materials?: number;
    },
  ): {
    wood: number;
    stone: number;
    food: number;
    water: number;
    metal?: number;
    rare_materials?: number;
  };
}

/**
 * Minimal interface for crafting operations needed by AIZoneHandler.
 */
export interface AIZoneCraftingPort {
  craftBestWeapon(agentId: string): string | null;
}

/**
 * Minimal interface for quest operations needed by AIZoneHandler.
 */
export interface AIZoneQuestPort {
  startQuest(questId: string): void;
}

/**
 * Minimal interface for role operations needed by AIZoneHandler.
 */
export interface AIZoneRolePort {
  getAgentRole(agentId: string): { roleType: string } | null;
}

/**
 * Minimal interface for social operations needed by AIZoneHandler.
 */
export interface AIZoneSocialPort {
  registerFriendlyInteraction(agentId: string, targetId: string): void;
  imposeLocalTruces(agentId: string, radius: number, duration: number): void;
}

/**
 * Minimal interface for household operations needed by AIZoneHandler.
 */
export interface AIZoneHouseholdPort {
  findHouseholdForAgent(agentId: string): { zoneId: string } | null;
}

/**
 * Minimal interface for needs operations needed by AIZoneHandler.
 */
export interface AIZoneNeedsPort {
  getNeeds(entityId: string): {
    hunger: number;
    thirst: number;
    energy: number;
    social: number;
    fun: number;
  } | null;
}

import type { AgentRegistry } from "../../../core/AgentRegistry";

export interface AIZoneHandlerDeps {
  gameState: GameState;
  inventorySystem: AIZoneInventoryPort | null;
  craftingSystem: AIZoneCraftingPort | null;
  questSystem: AIZoneQuestPort | null;
  roleSystem: AIZoneRolePort | null;
  socialSystem: AIZoneSocialPort | null;
  householdSystem: AIZoneHouseholdPort | null;
  needsSystem: AIZoneNeedsPort | null;
  goalsCompletedRef: { value: number };
  agentRegistry?: AgentRegistry;
}

import { ActivityType } from "../../../../../shared/constants/MovementEnums";

/**
 * Handles zone arrival notifications and resource deposits for AI agents.
 *
 * Manages goal completion, zone-based actions (crafting, deposit, trade),
 * and activity tracking when agents arrive at zones. Extracted from AISystem
 * to improve modularity and separation of concerns.
 *
 * Features:
 * - Goal completion detection on zone arrival
 * - Automatic resource deposits to stockpiles
 * - Zone-specific action handling (crafting, building contribution)
 * - Activity duration estimation based on zone type and needs
 * - Home zone tracking for agents
 *
 * @see AISystem for goal planning and evaluation
 */
export class AIZoneHandler {
  private readonly deps: AIZoneHandlerDeps;

  constructor(deps: AIZoneHandlerDeps) {
    this.deps = deps;
  }

  /**
   * Notifies that an entity has arrived at a zone.
   * Handles goal completion, zone-based actions (crafting, deposit, trade), and activity tracking.
   */
  public notifyEntityArrived(
    entityId: string,
    zoneId: string | undefined,
    aiState: AIState,
  ): void {
    if (aiState.currentAction?.actionType === "move") {
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: entityId,
        success: true,
        actionType: "move",
      });
    }

    if (!aiState.currentGoal) return;

    const goal = aiState.currentGoal;

    if (zoneId) {
      aiState.memory.visitedZones.add(zoneId);
      this.updateHomeZoneIfNeeded(entityId, zoneId, aiState);
    }

    if (this.handleAssistGoal(entityId, goal, aiState)) {
      return;
    }

    if (this.handleCraftGoal(entityId, goal, aiState)) {
      return;
    }

    if (zoneId && this.handleDepositGoal(entityId, zoneId, goal, aiState)) {
      return;
    }

    if (zoneId && this.handleTradeAction(entityId, zoneId, goal, aiState)) {
      return;
    }

    if (
      zoneId &&
      this.handleBuildingContribution(entityId, zoneId, goal, aiState)
    ) {
      return;
    }

    if (this.handleQuestStart(goal, aiState)) {
      return;
    }

    this.handleGuardTruces(entityId, goal);

    if (zoneId) {
      this.emitActivityStarted(entityId, zoneId, goal, aiState);
    }

    aiState.currentGoal = null;
    aiState.currentAction = null;
    this.deps.goalsCompletedRef.value++;
  }

  /**
   * Attempts to deposit resources from agent inventory to a stockpile in the zone.
   *
   * Creates a stockpile if none exists in the zone. Transfers all available
   * resources (wood, stone, food, water, metal, rare_materials) to the stockpile.
   * Emits RESOURCES_DEPOSITED event on successful transfer.
   *
   * @param entityId - Agent ID attempting deposit
   * @param zoneId - Zone ID where deposit should occur
   */
  public tryDepositResources(entityId: string, zoneId: string): void {
    const inventorySystem = this.deps.inventorySystem;
    if (!inventorySystem) {
      logger.debug(`📦 [DEPOSIT] ${entityId}: No inventory system`);
      return;
    }

    const inv = inventorySystem.getAgentInventory(entityId);
    if (!inv) {
      logger.debug(`📦 [DEPOSIT] ${entityId}: No inventory found`);
      return;
    }

    logger.debug(
      `📦 [DEPOSIT] ${entityId} attempting deposit: wood=${inv.wood}, stone=${inv.stone}, metal=${inv.metal}, rare=${inv.rare_materials}`,
    );

    let stockpiles = inventorySystem.getStockpilesInZone(zoneId);
    if (stockpiles.length === 0) {
      const stockpile = inventorySystem.createStockpile(zoneId, "general");
      stockpiles = [stockpile];
      logger.debug(`📦 [DEPOSIT] Created stockpile in zone ${zoneId}`);
    }

    const stockpile = stockpiles[0];
    const resourcesToTransfer = {
      wood: inv.wood,
      stone: inv.stone,
      food: inv.food,
      water: inv.water,
      metal: inv.metal || 0,
      rare_materials: inv.rare_materials || 0,
    };

    const transferred = inventorySystem.transferToStockpile(
      entityId,
      stockpile.id,
      resourcesToTransfer,
    );

    const totalTransferred =
      transferred.wood +
      transferred.stone +
      transferred.food +
      transferred.water +
      (transferred.metal || 0) +
      (transferred.rare_materials || 0);

    if (totalTransferred > 0) {
      simulationEvents.emit(GameEventNames.RESOURCES_DEPOSITED, {
        agentId: entityId,
        zoneId,
        stockpileId: stockpile.id,
        resources: transferred,
      });
    }
  }

  /**
   * Picks the appropriate activity type for a zone based on zone type.
   *
   * @param zoneType - Type of zone (food, water, rest, work, etc.)
   * @param _goal - Current AI goal (unused but kept for API compatibility)
   * @returns Activity type matching the zone
   */
  public pickActivityForZone(zoneType: string, _goal: AIGoal): ActivityType {
    switch (zoneType) {
      case ZoneType.FOOD:
      case ZoneType.WATER:
        return ActivityType.EATING;
      case ZoneType.REST:
      case ZoneType.SHELTER:
        return ActivityType.RESTING;
      case ZoneType.SOCIAL:
      case ZoneType.MARKET:
      case ZoneType.GATHERING:
        return ActivityType.SOCIALIZING;
      case ZoneType.WORK:
        return ActivityType.WORKING;
      default:
        return ActivityType.IDLE;
    }
  }

  /**
   * Estimates the duration of an activity based on zone type and agent needs.
   *
   * Base durations vary by zone type. Duration is extended if agent needs
   * are critical (below 30) or low (below 50) to allow more time for satisfaction.
   *
   * @param entityId - Agent ID
   * @param zoneType - Type of zone
   * @param goal - Current AI goal
   * @returns Estimated activity duration in milliseconds
   */
  public estimateActivityDuration(
    entityId: string,
    zoneType: string,
    goal: AIGoal,
  ): number {
    const baseDurations: Record<string, number> = {
      food: 4000,
      water: 2500,
      rest: 4000,
      shelter: 4000,
      social: 4000,
      work: 6000,
      default: 3000,
    };

    let baseDuration = baseDurations[zoneType] || baseDurations.default;

    if (this.deps.needsSystem && goal.data?.need) {
      const needs = this.deps.needsSystem.getNeeds(entityId);
      if (needs) {
        const needValue =
          (needs[goal.data.need as keyof typeof needs] as number) || 100;
        if (needValue < 30) {
          baseDuration *= 1.5;
        } else if (needValue < 50) {
          baseDuration *= 1.25;
        }
      }
    }

    return baseDuration;
  }

  private updateHomeZoneIfNeeded(
    entityId: string,
    zoneId: string,
    aiState: AIState,
  ): void {
    if (aiState.memory.homeZoneId || !this.deps.householdSystem) return;

    const zone = this.deps.gameState.zones?.find((z) => z.id === zoneId);
    if (
      zone &&
      (zone.type === ZoneType.REST ||
        zone.type === ZoneType.SHELTER ||
        zone.type === ZoneType.BEDROOM)
    ) {
      const household =
        this.deps.householdSystem.findHouseholdForAgent(entityId);
      if (household && household.zoneId === zoneId) {
        aiState.memory.homeZoneId = zoneId;
      }
    }
  }

  private handleAssistGoal(
    entityId: string,
    goal: AIGoal,
    aiState: AIState,
  ): boolean {
    if (
      !(goal.type === GoalType.ASSIST || goal.type.startsWith("assist_")) ||
      !goal.data?.targetAgentId
    ) {
      return false;
    }

    const targetId = goal.data.targetAgentId as string;

    const targetAgent = this.deps.agentRegistry?.getProfile(targetId);
    if (!targetAgent || targetAgent.isDead) {
      aiState.currentGoal = null;
      aiState.currentAction = null;
      return true;
    }

    const resourceType = goal.data.resourceType as string;
    const amount = (goal.data.amount as number) || 10;

    if (this.deps.inventorySystem && this.deps.socialSystem) {
      const inv = this.deps.inventorySystem.getAgentInventory(entityId);
      if (!inv) {
        aiState.currentGoal = null;
        aiState.currentAction = null;
        return true;
      }

      const resourceValue = inv[resourceType as keyof typeof inv];
      if (typeof resourceValue === "number" && resourceValue >= amount) {
        this.deps.inventorySystem.removeFromAgent(
          entityId,
          resourceType as ResourceType,
          amount,
        );
        this.deps.inventorySystem.addResource(
          targetId,
          resourceType as ResourceType,
          amount,
        );
        this.deps.socialSystem.registerFriendlyInteraction(entityId, targetId);
      }
    }

    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleCraftGoal(
    entityId: string,
    goal: AIGoal,
    aiState: AIState,
  ): boolean {
    if (goal.type !== GoalType.CRAFT || goal.data?.itemType !== ItemCategory.WEAPON) {
      return false;
    }

    if (this.deps.craftingSystem) {
      const weaponId = this.deps.craftingSystem.craftBestWeapon(entityId);
      if (weaponId) {
        simulationEvents.emit(GameEventNames.ITEM_CRAFTED, {
          agentId: entityId,
          itemId: weaponId,
        });
      }
    }

    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleDepositGoal(
    entityId: string,
    zoneId: string,
    goal: AIGoal,
    aiState: AIState,
  ): boolean {
    if (goal.type !== GoalType.DEPOSIT && goal.data?.workType !== "deposit") {
      return false;
    }

    this.tryDepositResources(entityId, zoneId);
    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleTradeAction(
    entityId: string,
    zoneId: string,
    goal: AIGoal,
    aiState: AIState,
  ): boolean {
    if (goal.data?.action !== "trade") {
      return false;
    }

    simulationEvents.emit(GameEventNames.AGENT_ACTIVITY_STARTED, {
      agentId: entityId,
      zoneId,
      activity: "working",
      duration: 5000,
    });

    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleBuildingContribution(
    entityId: string,
    zoneId: string,
    goal: AIGoal,
    aiState: AIState,
  ): boolean {
    if (goal.data?.action !== "contribute_resources") {
      return false;
    }

    if (this.deps.inventorySystem) {
      const inv = this.deps.inventorySystem.getAgentInventory(entityId);
      if (inv) {
        const transferred = {
          wood: Math.min(inv.wood || 0, 10),
          stone: Math.min(inv.stone || 0, 10),
        };
        if (transferred.wood > 0) {
          this.deps.inventorySystem.removeFromAgent(
            entityId,
            "wood" as ResourceType,
            transferred.wood,
          );
        }
        if (transferred.stone > 0) {
          this.deps.inventorySystem.removeFromAgent(
            entityId,
            "stone" as ResourceType,
            transferred.stone,
          );
        }
        simulationEvents.emit(GameEventNames.RESOURCES_DEPOSITED, {
          agentId: entityId,
          zoneId,
          resources: transferred,
        });
      }
    }

    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleQuestStart(goal: AIGoal, aiState: AIState): boolean {
    if (goal.data?.action !== "start_quest" || !goal.data?.questId) {
      return false;
    }

    if (this.deps.questSystem) {
      const questId = goal.data.questId as string;
      this.deps.questSystem.startQuest(questId);
    }

    aiState.currentGoal = null;
    aiState.currentAction = null;
    return true;
  }

  private handleGuardTruces(entityId: string, goal: AIGoal): void {
    if (!this.deps.roleSystem || !this.deps.socialSystem) return;

    const role = this.deps.roleSystem.getAgentRole(entityId);
    if (
      role?.roleType === "guard" &&
      (goal.targetZoneId || "").toLowerCase().includes("defense")
    ) {
      this.deps.socialSystem.imposeLocalTruces(entityId, 140, 45000);
    }
  }

  private emitActivityStarted(
    entityId: string,
    zoneId: string,
    goal: AIGoal,
    aiState: AIState,
  ): void {
    const zone = this.deps.gameState.zones?.find((z) => z.id === zoneId);
    if (!zone) return;

    const activity = this.pickActivityForZone(zone.type, goal);
    const duration = this.estimateActivityDuration(entityId, zone.type, goal);

    simulationEvents.emit(GameEventNames.AGENT_ACTIVITY_STARTED, {
      agentId: entityId,
      zoneId,
      activity,
      duration,
    });

    const successCount = aiState.memory.successfulActivities?.get(zoneId) || 0;
    aiState.memory.successfulActivities?.set(zoneId, successCount + 1);
  }
}
