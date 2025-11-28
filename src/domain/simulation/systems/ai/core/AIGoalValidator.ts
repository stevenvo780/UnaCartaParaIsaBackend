import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AIState } from "../../../../types/simulation/ai";
import type { WorldResourceSystem } from "../../WorldResourceSystem";
import type { NeedsSystem } from "../../NeedsSystem";
import type { AnimalSystem } from "../../AnimalSystem";
import { isWorldResourceType } from "../../../../types/simulation/resourceMapping";
import { WorldResourceType } from "../../../../types/simulation/worldResources";
import { getFrameTime } from "../../../../../shared/FrameTime";
import {
  NeedType,
  GoalType,
  GoalPrefix,
} from "../../../../../shared/constants/AIEnums";
import {
  ResourceType,
  ResourceState,
} from "../../../../../shared/constants/ResourceEnums";
import type { AgentRegistry } from "../../../core/AgentRegistry";
import { logger } from "../../../../../infrastructure/utils/logger";

export interface AIGoalValidatorDeps {
  gameState: GameState;
  worldResourceSystem?: WorldResourceSystem;
  needsSystem?: NeedsSystem;
  animalSystem?: AnimalSystem;
  agentRegistry: AgentRegistry;
}

/**
 * Validates AI goals for completion or invalidity.
 * Checks resource availability, target existence, timeouts, and completion conditions.
 */
export class AIGoalValidator {
  private readonly deps: AIGoalValidatorDeps;
  private readonly GOAL_TIMEOUT_MS = 60000;
  private readonly ARRIVAL_THRESHOLD = 50;

  private _goalsCompleted = 0;
  private _goalsFailed = 0;
  private _goalsTimedOut = 0;
  private _goalsExpired = 0;

  constructor(deps: AIGoalValidatorDeps) {
    this.deps = deps;
  }

  /**
   * Gets the number of goals completed.
   */
  public get goalsCompleted(): number {
    return this._goalsCompleted;
  }

  /**
   * Gets the number of goals failed.
   */
  public get goalsFailed(): number {
    return this._goalsFailed;
  }

  /**
   * Gets the number of goals that timed out.
   */
  public get goalsTimedOut(): number {
    return this._goalsTimedOut;
  }

  /**
   * Gets the number of goals that expired.
   */
  public get goalsExpired(): number {
    return this._goalsExpired;
  }

  /**
   * Resets goal metrics.
   */
  public resetMetrics(): void {
    this._goalsCompleted = 0;
    this._goalsFailed = 0;
    this._goalsTimedOut = 0;
    this._goalsExpired = 0;
  }

  /**
   * Checks if a goal is completed.
   */
  public isGoalCompleted(goal: AIGoal, agentId: string): boolean {
    const now = Date.now();

    if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
      return false;
    }

    if (goal.type.startsWith(GoalPrefix.SATISFY)) {
      const needType = goal.data?.need as string;
      if (needType && this.deps.needsSystem) {
        const needs = this.deps.needsSystem.getNeeds(agentId);
        if (needs) {
          const needValue = needs[needType as keyof typeof needs] as number;
          if (needValue > 70) {
            return true;
          }
        }
      }
    }

    if (goal.targetPosition) {
      const agentPos = this.deps.agentRegistry.getPosition(agentId) ?? null;
      if (!agentPos) return false;

      const dist = Math.hypot(
        agentPos.x - goal.targetPosition.x,
        agentPos.y - goal.targetPosition.y,
      );
      if (dist > this.ARRIVAL_THRESHOLD) {
        return false;
      }
    }

    if (goal.targetZoneId) {
      const agentPos = this.deps.agentRegistry.getPosition(agentId) ?? null;
      if (!agentPos) return false;

      const zone = this.deps.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone || !zone.bounds) return false;

      const inZone =
        agentPos.x >= zone.bounds.x &&
        agentPos.x <= zone.bounds.x + zone.bounds.width &&
        agentPos.y >= zone.bounds.y &&
        agentPos.y <= zone.bounds.y + zone.bounds.height;

      if (!inZone) {
        return false;
      }
    }

    const resourceValid = this.isResourceTargetValid(goal);
    if (resourceValid === false) {
      return false;
    }

    if (
      (goal.type === GoalType.ASSIST ||
        goal.type.startsWith(GoalPrefix.ASSIST)) &&
      goal.data?.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.deps.agentRegistry?.getProfile(targetId);
      if (!targetAgent) {
        return false;
      }

      if (goal.data.need === NeedType.SOCIAL && this.deps.needsSystem) {
        const needs = this.deps.needsSystem.getNeeds(targetId);
        if (needs && (needs.social > 70 || needs.fun > 70)) {
          return true;
        }
      }
      return false;
    }

    if (goal.type === GoalType.GATHER || goal.type === GoalType.WORK) {
      if (goal.targetId && goal.data?.resourceType) {
        return false;
      }

      if (goal.targetZoneId) {
        const agentPos = this.deps.agentRegistry.getPosition(agentId) ?? null;
        if (!agentPos) return false;

        const zone = this.deps.gameState.zones?.find(
          (z) => z.id === goal.targetZoneId,
        );
        if (!zone || !zone.bounds) return false;

        return false;
      }
    }

    if (goal.targetPosition || goal.targetZoneId) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a goal is invalid due to timeout only.
   * Used by AISystem to queue re-evaluations instead of immediate invalidation.
   * Returns true if the goal timed out but target/resources are still valid.
   */
  public isGoalTimedOut(goal: AIGoal, _agentId: string): boolean {
    const now = Date.now();

    if (goal.expiresAt && now > goal.expiresAt) {
      return true;
    }

    if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a goal has a "hard" invalidation (target gone, resource depleted, etc.)
   * These should be handled immediately, not queued.
   */
  public isGoalHardInvalid(goal: AIGoal, agentId: string): boolean {
    if (goal.targetZoneId) {
      const zone = this.deps.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone) {
        logger.debug(
          `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} zone not found`,
        );
        return true;
      }
    }

    const resourceValid = this.isResourceTargetValid(goal);
    if (resourceValid === false) {
      logger.debug(
        `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} resource invalid`,
      );
      return true;
    }

    const huntTargetValid = this.isHuntTargetValid(goal);
    if (huntTargetValid === false) {
      logger.debug(
        `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} hunt target invalid`,
      );
      return true;
    }

    const combatTargetValid = this.isCombatTargetValid(goal);
    if (combatTargetValid === false) {
      logger.debug(
        `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} combat target invalid`,
      );
      return true;
    }

    if (
      (goal.type === GoalType.ASSIST ||
        goal.type.startsWith(GoalPrefix.ASSIST)) &&
      goal.data?.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.deps.agentRegistry?.getProfile(targetId);
      if (!targetAgent || targetAgent.isDead) {
        logger.debug(
          `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} assist target invalid`,
        );
        return true;
      }
    }

    const agent = this.deps.agentRegistry?.getProfile(agentId);
    if (!agent || agent.isDead) {
      logger.debug(
        `🚫 [HARD_INVALID] ${agentId} goal ${goal.type} agent not found or dead`,
      );
      return true;
    }

    return false;
  }

  /**
   * Checks if a goal is invalid and should be abandoned.
   */
  public isGoalInvalid(goal: AIGoal, agentId: string): boolean {
    const now = Date.now();

    if (goal.expiresAt && now > goal.expiresAt) {
      logger.debug(`🚫 [INVALID] ${agentId} goal ${goal.type} expired`);
      this._goalsExpired++;
      return true;
    }

    if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
      logger.debug(
        `🚫 [INVALID] ${agentId} goal ${goal.type} timeout after ${this.GOAL_TIMEOUT_MS}ms`,
      );
      this._goalsTimedOut++;
      return true;
    }

    if (goal.targetZoneId) {
      const zone = this.deps.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone) {
        logger.debug(
          `🚫 [INVALID] ${agentId} goal ${goal.type} zone not found`,
        );
        return true;
      }
    }

    const resourceValid = this.isResourceTargetValid(goal);
    if (resourceValid === false) {
      logger.debug(
        `🚫 [INVALID] ${agentId} goal ${goal.type} resource invalid`,
      );
      return true;
    }

    const huntTargetValid = this.isHuntTargetValid(goal);
    if (huntTargetValid === false) {
      logger.debug(
        `🚫 [INVALID] ${agentId} goal ${goal.type} hunt target invalid`,
      );
      return true;
    }

    const combatTargetValid = this.isCombatTargetValid(goal);
    if (combatTargetValid === false) {
      logger.debug(
        `🚫 [INVALID] ${agentId} goal ${goal.type} combat target invalid`,
      );
      return true;
    }

    if (
      (goal.type === GoalType.ASSIST ||
        goal.type.startsWith(GoalPrefix.ASSIST)) &&
      goal.data?.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.deps.agentRegistry?.getProfile(targetId);
      if (!targetAgent || targetAgent.isDead) {
        logger.debug(
          `🚫 [INVALID] ${agentId} goal ${goal.type} assist target invalid`,
        );
        return true;
      }
    }

    const agent = this.deps.agentRegistry?.getProfile(agentId);
    if (!agent || agent.isDead) {
      logger.debug(
        `🚫 [INVALID] ${agentId} goal ${goal.type} agent not found or dead`,
      );
      return true;
    }

    return false;
  }

  /**
   * Marks a goal as completed, clearing state.
   */
  public completeGoal(aiState: AIState): void {
    aiState.currentGoal = null;
    aiState.currentAction = null;
    aiState.lastDecisionTime = getFrameTime();
    this._goalsCompleted++;
  }

  /**
   * Marks a goal as failed, recording the failure.
   */
  public failGoal(aiState: AIState): void {
    if (aiState.currentGoal?.targetZoneId) {
      const zoneId = aiState.currentGoal.targetZoneId;
      const fails = aiState.memory.failedAttempts?.get(zoneId) || 0;
      aiState.memory.failedAttempts?.set(zoneId, fails + 1);
    }
    aiState.currentGoal = null;
    aiState.currentAction = null;
    aiState.lastDecisionTime = getFrameTime();
    this._goalsFailed++;
  }

  /**
   * Validates if a resource target is still valid.
   * Returns true if valid, false if invalid, null if not applicable.
   */
  private isResourceTargetValid(goal: AIGoal): boolean | null {
    if (goal.type === GoalType.HUNT) {
      return null;
    }

    if (!goal.targetId) {
      return null;
    }

    if (this.deps.gameState.worldResources) {
      const resource = this.deps.gameState.worldResources[goal.targetId];
      if (resource) {
        return resource.state !== ResourceState.DEPLETED;
      }
    }

    if (this.deps.worldResourceSystem) {
      const resourceTypeStr = goal.data?.resourceType as string | undefined;

      if (resourceTypeStr && isWorldResourceType(resourceTypeStr)) {
        const resources =
          this.deps.worldResourceSystem.getResourcesByType(resourceTypeStr);
        const targetResource = resources.find((r) => r.id === goal.targetId);
        if (targetResource) {
          return targetResource.state !== ResourceState.DEPLETED;
        }
      }

      if (resourceTypeStr === ResourceType.FOOD) {
        const foodTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];
        for (const foodType of foodTypes) {
          if (isWorldResourceType(foodType)) {
            const resources =
              this.deps.worldResourceSystem.getResourcesByType(foodType);
            const targetResource = resources.find(
              (r) => r.id === goal.targetId,
            );
            if (targetResource) {
              return targetResource.state !== ResourceState.DEPLETED;
            }
          }
        }
      }

      if (resourceTypeStr === ResourceType.WATER) {
        const resources = this.deps.worldResourceSystem.getResourcesByType(
          WorldResourceType.WATER_SOURCE,
        );
        const targetResource = resources.find((r) => r.id === goal.targetId);
        if (targetResource) {
          return targetResource.state !== ResourceState.DEPLETED;
        }
      }

      if (resourceTypeStr === ResourceType.WOOD) {
        const resources = this.deps.worldResourceSystem.getResourcesByType(
          WorldResourceType.TREE,
        );
        const targetResource = resources.find((r) => r.id === goal.targetId);
        if (targetResource) {
          return targetResource.state !== ResourceState.DEPLETED;
        }
      }

      if (resourceTypeStr === ResourceType.STONE) {
        const resources = this.deps.worldResourceSystem.getResourcesByType(
          WorldResourceType.ROCK,
        );
        const targetResource = resources.find((r) => r.id === goal.targetId);
        if (targetResource) {
          return targetResource.state !== ResourceState.DEPLETED;
        }
      }
    }

    return false;
  }

  /**
   * Validates if a combat target is still valid.
   */
  private isCombatTargetValid(goal: AIGoal): boolean | null {
    if (goal.type !== GoalType.ATTACK && goal.type !== GoalType.COMBAT) {
      return null;
    }

    if (!goal.targetId) {
      return null;
    }

    const targetAgent = this.deps.agentRegistry?.getProfile(goal.targetId);
    if (targetAgent) {
      return !targetAgent.isDead;
    }

    const targetAnimal = this.deps.animalSystem?.getAnimal(goal.targetId);
    if (targetAnimal) {
      return !targetAnimal.isDead;
    }

    return false;
  }

  /**
   * Validates if a hunt target (animal) is still valid.
   */
  private isHuntTargetValid(goal: AIGoal): boolean | null {
    if (goal.type !== GoalType.HUNT) {
      return null;
    }

    if (!goal.targetId) {
      return null;
    }

    const targetAnimal = this.deps.animalSystem?.getAnimal(goal.targetId);
    if (targetAnimal) {
      return !targetAnimal.isDead;
    }

    return false;
  }
}
