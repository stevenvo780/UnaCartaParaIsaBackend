import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AIState } from "../../../../types/simulation/ai";
import type { WorldResourceSystem } from "../../WorldResourceSystem";
import type { NeedsSystem } from "../../NeedsSystem";
import type { AnimalSystem } from "../../AnimalSystem";
import { isWorldResourceType } from "../../../../types/simulation/resourceMapping";
import { getFrameTime } from "../../../../../shared/FrameTime";

export interface AIGoalValidatorDeps {
  gameState: GameState;
  worldResourceSystem?: WorldResourceSystem;
  needsSystem?: NeedsSystem;
  animalSystem?: AnimalSystem;
  getAgentPosition: (agentId: string) => { x: number; y: number } | null;
}

/**
 * Validates AI goals for completion or invalidity.
 * Checks resource availability, target existence, timeouts, and completion conditions.
 */
export class AIGoalValidator {
  private readonly deps: AIGoalValidatorDeps;
  private readonly GOAL_TIMEOUT_MS = 60000; // 60 seconds max for any goal
  private readonly ARRIVAL_THRESHOLD = 50;

  // Metrics
  private _goalsCompleted = 0;
  private _goalsFailed = 0;

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
   * Resets goal metrics.
   */
  public resetMetrics(): void {
    this._goalsCompleted = 0;
    this._goalsFailed = 0;
  }

  /**
   * Checks if a goal is completed.
   */
  public isGoalCompleted(goal: AIGoal, agentId: string): boolean {
    const now = Date.now();

    if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
      return false;
    }

    // Check satisfy_* goals FIRST - if need is already satisfied, goal is complete
    if (goal.type.startsWith("satisfy_")) {
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

    // Validate position before marking goal complete
    if (goal.targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (!agentPos) return false;

      const dist = Math.hypot(
        agentPos.x - goal.targetPosition.x,
        agentPos.y - goal.targetPosition.y,
      );
      if (dist > this.ARRIVAL_THRESHOLD) {
        return false;
      }
    }

    // Validate zone arrival
    if (goal.targetZoneId) {
      const agentPos = this.deps.getAgentPosition(agentId);
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

    // Validate resource target if applicable
    const resourceValid = this.isResourceTargetValid(goal);
    if (resourceValid === false) {
      return false;
    }

    // Check assist goals
    if (
      (goal.type === "assist" || goal.type.startsWith("assist_")) &&
      goal.data?.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.deps.gameState.agents?.find(
        (a) => a.id === targetId,
      );
      if (!targetAgent) {
        return false;
      }

      if (goal.data.resourceType === "social" && this.deps.needsSystem) {
        const needs = this.deps.needsSystem.getNeeds(targetId);
        if (needs && (needs.social > 70 || needs.fun > 70)) {
          return true;
        }
      }
      return false;
    }

    // Goal is complete if agent reached target
    if (goal.targetPosition || goal.targetZoneId) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a goal is invalid and should be abandoned.
   */
  public isGoalInvalid(goal: AIGoal, agentId: string): boolean {
    const now = Date.now();

    // Goal expired explicitly
    if (goal.expiresAt && now > goal.expiresAt) {
      return true;
    }

    // Goal timed out
    if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
      return true;
    }

    // Zone doesn't exist
    if (goal.targetZoneId) {
      const zone = this.deps.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone) {
        return true;
      }
    }

    // Resource invalid
    const resourceValid = this.isResourceTargetValid(goal);
    if (resourceValid === false) {
      return true;
    }

    // Combat target invalid
    const combatTargetValid = this.isCombatTargetValid(goal);
    if (combatTargetValid === false) {
      return true;
    }

    // Assist target invalid
    if (
      (goal.type === "assist" || goal.type.startsWith("assist_")) &&
      goal.data?.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.deps.gameState.agents?.find(
        (a) => a.id === targetId,
      );
      if (!targetAgent || targetAgent.isDead) {
        return true;
      }
    }

    // Agent is dead
    const agent = this.deps.gameState.agents?.find((a) => a.id === agentId);
    if (!agent || agent.isDead) {
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
   */
  private isResourceTargetValid(goal: AIGoal): boolean | null {
    if (!goal.targetId || !goal.data?.resourceType) {
      return null;
    }

    const resourceTypeStr = goal.data.resourceType as string;

    if (this.deps.worldResourceSystem) {
      if (isWorldResourceType(resourceTypeStr)) {
        const resources =
          this.deps.worldResourceSystem.getResourcesByType(resourceTypeStr);
        const targetResource = resources.find((r) => r.id === goal.targetId);
        return !!(targetResource && targetResource.state === "pristine");
      }
      return false;
    }

    if (this.deps.gameState.worldResources) {
      const resource = this.deps.gameState.worldResources[goal.targetId];
      return !!(resource && resource.state === "pristine");
    }

    return null;
  }

  /**
   * Validates if a combat target is still valid.
   */
  private isCombatTargetValid(goal: AIGoal): boolean | null {
    if (goal.type !== "attack" && goal.type !== "combat") {
      return null;
    }

    if (!goal.targetId) {
      return null;
    }

    const targetAgent = this.deps.gameState.agents?.find(
      (a) => a.id === goal.targetId,
    );
    if (targetAgent) {
      return !targetAgent.isDead;
    }

    const targetAnimal = this.deps.animalSystem?.getAnimal(goal.targetId);
    if (targetAnimal) {
      return !targetAnimal.isDead;
    }

    return false;
  }
}
