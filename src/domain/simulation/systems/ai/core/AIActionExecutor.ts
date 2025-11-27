import { logger } from "../../../../../infrastructure/utils/logger";
import { getAnimalConfig } from "../../../../../infrastructure/services/world/config/AnimalConfigs";
import type { GameState } from "../../../../types/game-types";
import type { AgentAction } from "../../../../types/simulation/ai";
import { toInventoryResource } from "../../../../types/simulation/resourceMapping";
import type { NeedsSystem } from "../../NeedsSystem";
import type { InventorySystem } from "../../InventorySystem";
import type { SocialSystem } from "../../SocialSystem";
import type { EnhancedCraftingSystem } from "../../EnhancedCraftingSystem";
import type { WorldResourceSystem } from "../../WorldResourceSystem";
import type { TaskSystem } from "../../TaskSystem";
import type { MovementSystem } from "../../MovementSystem";
import { GameEventNames, simulationEvents } from "../../../core/events";
import { ActionType } from "../../../../../shared/constants/AIEnums";
import { NeedType } from "../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";

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
}

/**
 * Executes AI actions by coordinating with game systems.
 * Handles movement, harvesting, combat, social interactions, crafting, etc.
 */
export class AIActionExecutor {
  private deps: AIActionExecutorDeps;

  constructor(deps: AIActionExecutorDeps) {
    this.deps = deps;
  }

  /**
   * Updates dependencies (for circular dependency resolution).
   */
  public updateDeps(deps: Partial<AIActionExecutorDeps>): void {
    this.deps = { ...this.deps, ...deps };
  }

  /**
   * Executes an action for an agent.
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
    if (!movement) return;

    if (action.targetZoneId) {
      if (movement.isMovingToZone(action.agentId, action.targetZoneId)) {
        return;
      }
      movement.moveToZone(action.agentId, action.targetZoneId);
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

    const agent = this.deps.gameState.agents?.find(
      (a) => a.id === action.agentId,
    );
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

      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
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
        const inventoryResourceType = toInventoryResource(resource.type);

        if (resource.type === "water_source" && this.deps.needsSystem) {
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

        if (inventoryResourceType && this.deps.inventorySystem) {
          const added = this.deps.inventorySystem.addResource(
            action.agentId,
            inventoryResourceType,
            result.amount,
          );
          if (added) {
            logger.debug(
              `🎒 [AI] Agent ${action.agentId} added ${result.amount} ${inventoryResourceType} to inventory`,
            );
          }
        }
      }
    }

    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.HARVEST,
      success: result.success,
      data: { amount: result.amount },
    });
  }

  private executeIdle(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.ENERGY, 5);
    }
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.IDLE,
      success: true,
    });
  }

  private executeAttack(action: AgentAction): void {
    const targetId = action.targetId;
    if (!targetId) {
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.ATTACK,
        success: false,
        data: { reason: "no_target" },
      });
      return;
    }

    // Check if target is an animal
    const animals = this.deps.gameState.animals?.animals;
    const targetAnimal = animals?.find((a) => a.id === targetId && !a.isDead);

    if (targetAnimal) {
      // Get animal config to determine food value
      const config = getAnimalConfig(targetAnimal.type);
      const foodValue = config?.foodValue ?? 15;

      // Mark animal as dead
      targetAnimal.isDead = true;
      targetAnimal.state = "dead";

      // Add food to hunter's inventory
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

      // Satisfy hunger immediately with some of the kill
      if (this.deps.needsSystem) {
        this.deps.needsSystem.satisfyNeed(
          action.agentId,
          NeedType.HUNGER,
          Math.min(foodValue * 0.3, 25),
        );
      }

      // Emit hunt success event
      simulationEvents.emit(GameEventNames.ANIMAL_HUNTED, {
        animalId: targetId,
        hunterId: action.agentId,
        foodValue,
        animalType: targetAnimal.type,
      });

      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: "attack",
        success: true,
        data: { targetId, targetType: "animal", foodValue },
      });
    } else {
      // Target is not an animal (could be another agent - combat)
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.ATTACK,
        success: true,
        data: { targetId, targetType: "unknown" },
      });
    }
  }

  private executeSocialize(action: AgentAction): void {
    // If we have a target agent, interact with them specifically
    if (action.targetId && this.deps.socialSystem) {
      this.deps.socialSystem.registerFriendlyInteraction(
        action.agentId,
        action.targetId,
      );
      if (this.deps.needsSystem) {
        this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.SOCIAL, 15);
        this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.FUN, 5);
      }
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.SOCIALIZE,
        success: true,
        data: { targetId: action.targetId },
      });
      return;
    }

    // Socializing in a zone or in general - satisfy social need
    if (this.deps.needsSystem) {
      // More social satisfaction in designated zones, less elsewhere
      const socialBoost = action.targetZoneId ? 12 : 5;
      const funBoost = action.targetZoneId ? 8 : 3;
      this.deps.needsSystem.satisfyNeed(
        action.agentId,
        NeedType.SOCIAL,
        socialBoost,
      );
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.FUN, funBoost);
    }

    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
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
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.EAT,
      success: true,
    });
  }

  private executeDrink(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.THIRST, 30);
    }
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.DRINK,
      success: true,
    });
  }

  private executeSleep(action: AgentAction): void {
    if (this.deps.needsSystem) {
      this.deps.needsSystem.satisfyNeed(action.agentId, NeedType.ENERGY, 50);
    }
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.SLEEP,
      success: true,
    });
  }

  private executeCraft(action: AgentAction): void {
    if (this.deps.craftingSystem && action.data?.itemType === "weapon") {
      const weaponId = this.deps.craftingSystem.craftBestWeapon(action.agentId);
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: action.agentId,
        actionType: ActionType.CRAFT,
        success: !!weaponId,
        data: { weaponId },
      });
    } else {
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
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
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
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
          t.type === "build" || t.type === "construction",
      );
      if (constructionTask) {
        const result = this.deps.taskSystem.contributeToTask(
          constructionTask.id,
          action.agentId,
          10,
          1.0,
        );
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
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
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: action.agentId,
      actionType: ActionType.BUILD,
      success: false,
    });
  }
}
