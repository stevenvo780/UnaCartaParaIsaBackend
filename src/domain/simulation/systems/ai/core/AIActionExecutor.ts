import { logger } from "../../../../../infrastructure/utils/logger";
import { getAnimalConfig } from "../../../../world/config/AnimalConfigs";
import type { GameState } from "../../../../types/game-types";
import type { AgentAction } from "../../../../types/simulation/ai";
import { itemToInventoryResource } from "../../../../types/simulation/resourceMapping";
import type { NeedsSystem } from "../../needs/NeedsSystem";
import type { InventorySystem } from "../../InventorySystem";
import type { SocialSystem } from "../../SocialSystem";
import type { EnhancedCraftingSystem } from "../../EnhancedCraftingSystem";
import type { WorldResourceSystem } from "../../WorldResourceSystem";
import type { TaskSystem } from "../../TaskSystem";
import type { MovementSystem } from "../../movement/MovementSystem";
import { GameEventType, simulationEvents } from "../../../core/events";
import { ActionType } from "../../../../../shared/constants/AIEnums";
import { NeedType } from "../../../../../shared/constants/AIEnums";
import {
  ResourceType,
  WorldResourceType,
} from "../../../../../shared/constants/ResourceEnums";
import { ItemCategory } from "../../../../../shared/constants/ItemEnums";
import { TaskType } from "../../../../../shared/constants/TaskEnums";
import { EntityType } from "../../../../../shared/constants/EntityEnums";
import type { AgentRegistry } from "../../../core/AgentRegistry";
import type { AnimalRegistry } from "../../../core/AnimalRegistry";

export interface AIActionExecutorDeps {
  gameState: GameState;
  needsSystem?: NeedsSystem;
  inventorySystem?: InventorySystem;
  socialSystem?: SocialSystem;
  craftingSystem?: EnhancedCraftingSystem;
  worldResourceSystem?: WorldResourceSystem;
  taskSystem?: TaskSystem;
  movementSystem?: MovementSystem;
  tryDepositResources: (entityId: string, zoneId: string) => void;
  agentRegistry?: AgentRegistry;
  animalRegistry?: AnimalRegistry;
}

/**
 * Executes AI actions by coordinating with game systems.
 *
 * Translates high-level AI goals into concrete system operations:
 * - Movement: Delegates to MovementSystem
 * - Harvesting: Uses WorldResourceSystem to gather resources
 * - Combat: Handles animal hunting and agent combat
 * - Social: Registers interactions via SocialSystem
 * - Crafting: Uses EnhancedCraftingSystem for item creation
 * - Needs: Satisfies needs through NeedsSystem
 *
 * All actions emit completion events for goal tracking and quest progression.
 *
 * @see MovementSystem for movement operations
 * @see WorldResourceSystem for resource harvesting
 * @see NeedsSystem for need satisfaction
 */
export class AIActionExecutor {
  private deps: AIActionExecutorDeps;

  constructor(deps: AIActionExecutorDeps) {
    this.deps = deps;
  }

  /**
   * Updates dependencies for circular dependency resolution.
   *
   * @param deps - Partial dependencies to merge with existing ones
   */
  public updateDeps(deps: Partial<AIActionExecutorDeps>): void {
    this.deps = { ...this.deps, ...deps };
  }

  /**
   * Executes an action for an agent.
   *
   * Routes the action to the appropriate system handler based on action type.
   * Emits completion events for goal tracking.
   *
   * @param action - Action to execute
   */
  public executeAction(action: AgentAction): void {
    if (!this.deps.movementSystem) return;

    switch (action.actionType) {
      case ActionType.MOVE:
        this.executeMove(action);
        break;
      case ActionType.WORK:
        this.executeWork(action);
        break;
      case ActionType.HARVEST:
        this.executeHarvest(action);
        break;
      case ActionType.IDLE:
        this.executeIdle(action);
        break;
      case ActionType.ATTACK:
        this.executeAttack(action);
        break;
      case ActionType.SOCIALIZE:
        this.executeSocialize(action);
        break;
      case ActionType.EAT:
        this.executeEat(action);
        break;
      case ActionType.DRINK:
        this.executeDrink(action);
        break;
      case ActionType.SLEEP:
        this.executeSleep(action);
        break;
      case ActionType.CRAFT:
        this.executeCraft(action);
        break;
      case ActionType.DEPOSIT:
        this.executeDeposit(action);
        break;
      case ActionType.BUILD:
        this.executeBuild(action);
        break;
      default:
        break;
    }
  }

  private executeMove(action: AgentAction): void {
    const movement = this.deps.movementSystem;
    if (!movement) {
      logger.warn(`🚶 [executeMove] ${action.agentId}: No movement system!`);
      return;
    }

    if (action.targetZoneId) {
      const alreadyMoving = movement.isMovingToZone(
        action.agentId,
        action.targetZoneId,
      );
      logger.debug(
        `🚶 [executeMove] ${action.agentId}: targetZone=${action.targetZoneId}, alreadyMoving=${alreadyMoving}`,
      );
      if (alreadyMoving) {
        return;
      }
      const result = movement.moveToZone(action.agentId, action.targetZoneId);
      logger.info(
        `🚶 [executeMove] ${action.agentId}: moveToZone result=${result}`,
      );
    } else if (action.targetPosition) {
      if (
        movement.isMovingToPosition(
          action.agentId,
          action.targetPosition.x,
          action.targetPosition.y,
        )
      ) {
        return;
      }
      movement.moveToPoint(
        action.agentId,
        action.targetPosition.x,
        action.targetPosition.y,
      );
    }
  }

  private executeWork(action: AgentAction): void {
    if (!action.targetZoneId) return;

    const movement = this.deps.movementSystem;
    if (movement?.isMovingToZone(action.agentId, action.targetZoneId)) {
      return;
    }

    const agent = this.deps.agentRegistry?.getProfile(action.agentId);
    if (!agent?.position) {
      movement?.moveToZone(action.agentId, action.targetZoneId);
      return;
    }

    const zone = this.deps.gameState.zones?.find(
      (z) => z.id === action.targetZoneId,
    );
    if (!zone || !zone.bounds) {
      movement?.moveToZone(action.agentId, action.targetZoneId);
      return;
    }

    const inZone =
      agent.position.x >= zone.bounds.x &&
      agent.position.x <= zone.bounds.x + zone.bounds.width &&
      agent.position.y >= zone.bounds.y &&
      agent.position.y <= zone.bounds.y + zone.bounds.height;

    if (!inZone) {
      movement?.moveToZone(action.agentId, action.targetZoneId);
      return;
    }

    if (
      this.deps.taskSystem &&
      action.data &&
      typeof action.data.taskId === "string"
    ) {
      const taskId = action.data.taskId as string;
      const result = this.deps.taskSystem.contributeToTask(
        taskId,
        action.agentId,
        10,
        1.0,
      );

      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.WORK,
        success: true,
        data: {
          taskId: taskId,
          progressMade: result.progressMade,
          completed: result.completed,
        },
      });
      return;
    }

    movement?.moveToZone(action.agentId, action.targetZoneId);
  }

  private executeHarvest(action: AgentAction): void {
    if (!action.targetId || !this.deps.worldResourceSystem) return;

    const result = this.deps.worldResourceSystem.harvestResource(
      action.targetId,
      action.agentId,
    );

    if (result.success) {
      const resource = this.deps.gameState.worldResources?.[action.targetId];
      if (resource) {
        if (
          resource.type === WorldResourceType.WATER_SOURCE &&
          this.deps.needsSystem
        ) {
          this.deps.needsSystem.satisfyNeed(
            action.agentId,
            NeedType.THIRST,
            30,
          );
        } else if (
          ["berry_bush", "mushroom_patch", "wheat_crop"].includes(
            resource.type,
          ) &&
          this.deps.needsSystem
        ) {
          this.deps.needsSystem.satisfyNeed(
            action.agentId,
            NeedType.HUNGER,
            25,
          );
        }

        if (this.deps.inventorySystem) {
          for (const item of result.items) {
            const inventoryResourceType = itemToInventoryResource(item.type);
            if (inventoryResourceType) {
              const added = this.deps.inventorySystem.addResource(
                action.agentId,
                inventoryResourceType,
                item.amount,
              );
              if (added) {
                logger.debug(
                  `🎒 [AI] Agent ${action.agentId} added ${item.amount} ${inventoryResourceType} (${item.type}) to inventory`,
                );
              }
            }
          }
        }
      }
    }

    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.HARVEST,
      success: result.success,
      data: { items: result.items },
    });
  }

  private executeIdle(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.ENERGY, 5);
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.IDLE,
      success: true,
    });
  }

  private executeAttack(action: AgentAction): void {
    const targetId = action.targetId;
    if (!targetId) {
      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.ATTACK,
        success: false,
        data: { reason: "no_target" },
      });
      return;
    }

    let targetAnimal = this.deps.animalRegistry?.getAnimal(targetId);
    if (!targetAnimal || targetAnimal.isDead) {
      const animals = this.deps.gameState.animals?.animals;
      targetAnimal = animals?.find((a) => a.id === targetId && !a.isDead);
    }

    if (!targetAnimal || targetAnimal.isDead) {
      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.ATTACK,
        success: false,
        data: { reason: "animal_not_found" },
      });
      return;
    }

    const config = getAnimalConfig(targetAnimal.type);
    const foodValue = config?.foodValue ?? 15;

    if (this.deps.animalRegistry) {
      this.deps.animalRegistry.markDead(targetId);
    }

    if (this.deps.inventorySystem) {
      this.deps.inventorySystem.addResource(
        action.agentId,
        ResourceType.FOOD,
        foodValue,
      );
      logger.info(
        `🏹 Agent ${action.agentId} hunted ${targetAnimal.type} and gained ${foodValue} food`,
      );
    }

    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(
        action.agentId,
        NeedType.HUNGER,
        Math.min(foodValue * 0.3, 25),
      );
    }

    simulationEvents.emit(GameEventType.ANIMAL_HUNTED, {
      animalId: targetId,
      hunterId: action.agentId,
      foodValue,
      animalType: targetAnimal.type,
    });

    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.ATTACK,
      success: true,
      data: { targetId, targetType: EntityType.ANIMAL, foodValue },
    });
  }

  private executeSocialize(action: AgentAction): void {
    if (action.targetId && this.deps.socialSystem) {
      this.deps.socialSystem.registerFriendlyInteraction(
        action.agentId,
        action.targetId,
      );
      if (this.deps.needsSystem) {
        this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.SOCIAL, 15);
        this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.FUN, 5);
      }
      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.SOCIALIZE,
        success: true,
        data: { targetId: action.targetId },
      });
      return;
    }

    if (this.deps.needsSystem) {
      const socialBoost = action.targetZoneId ? 12 : 5;
      const funBoost = action.targetZoneId ? 8 : 3;
      this.deps.needsSystem.satisfyNeed(
        action.agentId,
        NeedType.SOCIAL,
        socialBoost,
      );
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.FUN, funBoost);
    }

    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.SOCIALIZE,
      success: true,
      data: action.targetZoneId ? { zoneId: action.targetZoneId } : undefined,
    });
  }

  private executeEat(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.HUNGER, 30);
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.EAT,
      success: true,
    });
  }

  private executeDrink(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.THIRST, 30);
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.DRINK,
      success: true,
    });
  }

  private executeSleep(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.ENERGY, 50);
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.SLEEP,
      success: true,
    });
  }

  private executeCraft(action: AgentAction): void {
    logger.info(
      `⚒️ [executeCraft] ${action.agentId}: itemType=${action.data?.itemType}, itemId=${action.data?.itemId}`,
    );
    if (
      this.deps.craftingSystem &&
      action.data?.itemType === ItemCategory.WEAPON
    ) {
      logger.info(
        `⚒️ [executeCraft] ${action.agentId}: Calling craftBestWeapon`,
      );
      const weaponId = this.deps.craftingSystem.craftBestWeapon(action.agentId);
      logger.info(
        `⚒️ [executeCraft] ${action.agentId}: craftBestWeapon returned ${weaponId}`,
      );
      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.CRAFT,
        success: !!weaponId,
        data: { weaponId },
      });
    } else {
      logger.warn(
        `⚒️ [executeCraft] ${action.agentId}: Skipped - itemType mismatch (${action.data?.itemType} !== ${ItemCategory.WEAPON})`,
      );
      simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.CRAFT,
        success: false,
      });
    }
  }

  private executeDeposit(action: AgentAction): void {
    if (action.targetZoneId) {
      this.deps.tryDepositResources(action.agentId, action.targetZoneId);
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.DEPOSIT,
      success: true,
    });
  }

  private executeBuild(action: AgentAction): void {
    if (action.targetZoneId && this.deps.taskSystem) {
      const tasks = this.deps.taskSystem.getTasksInZone(action.targetZoneId);
      const constructionTask = tasks.find(
        (t: { type: string }) =>
          t.type === TaskType.BUILD_HOUSE ||
          t.type === TaskType.REPAIR_BUILDING,
      );
      if (constructionTask) {
        const result = this.deps.taskSystem.contributeToTask(
          constructionTask.id,
          action.agentId,
          10,
          1.0,
        );
        simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
          agentId: action.agentId,
          actionType: ActionType.BUILD,
          success: true,
          data: {
            taskId: constructionTask.id,
            progressMade: result.progressMade,
            completed: result.completed,
          },
        });
        return;
      }
    }
    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.BUILD,
      success: false,
    });
  }
}
