/**
 * SimpleActionPlanner.ts
 *
 * Simplified action planner using declarative rules.
 * Replaces 20+ planXXX methods with 4 generic handlers.
 */

import type { GameState } from "../../../../../types/game-types";
import type { AIGoal, AgentAction } from "../../../../../types/simulation/ai";
import { ActionType, GoalType } from "../../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../../shared/constants/ZoneEnums";
import type { AgentRegistry } from "../../../agents/AgentRegistry";
import {
  ACTION_PLAN_RULES,
  ATTACK_RANGE,
  EXPLORE_RANGE,
  HARVEST_RANGE,
  RESOURCE_SEARCH_MAP,
  TASK_SEARCH_MAP,
} from "./ActionPlanRules";
import { logger } from "../../../../../../infrastructure/utils/logger";

export interface SimpleActionPlannerDeps {
  gameState: GameState;
  agentRegistry: AgentRegistry;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  findNearestHuntableAnimal?: (
    entityId: string,
  ) => { id: string; x: number; y: number; type: string } | null;
  getAnimalPosition?: (animalId: string) => { x: number; y: number } | null;
  getAgentAttackRange?: (agentId: string) => number;
  agentHasWeapon?: (agentId: string) => boolean;
  tryClaimWeapon?: (agentId: string) => boolean;
}

/**
 * Simplified Action Planner using declarative rules.
 *
 * All goals map to one of 4 patterns:
 * 1. RangeAction: if within range → execute, else MOVE
 * 2. ZoneAction: if in zone → execute, else MOVE
 * 3. SimpleAction: just return action
 * 4. MoveAction: return MOVE to target
 */
export class SimpleActionPlanner {
  constructor(private readonly deps: SimpleActionPlannerDeps) {}

  private getPosition(agentId: string): { x: number; y: number } | null {
    return this.deps.agentRegistry.getPosition(agentId) ?? null;
  }

  /**
   * Main entry point: converts AIGoal → AgentAction
   */
  public planAction(agentId: string, goal: AIGoal): AgentAction | null {
    const timestamp = Date.now();
    const rule = ACTION_PLAN_RULES[goal.type];

    if (goal.type === GoalType.HUNT) {
      return this.handleHunt(agentId, goal, timestamp);
    }
    if (goal.type === GoalType.EXPLORE) {
      return this.handleExplore(agentId, goal, timestamp);
    }
    if (goal.type === GoalType.WORK) {
      return this.handleWork(agentId, goal, timestamp);
    }

    if (!rule) {
      logger.debug(`[SimpleActionPlanner] No rule for goal type: ${goal.type}`);
      return null;
    }

    switch (rule.type) {
      case "range":
        return this.handleRangeAction(agentId, goal, rule, timestamp);
      case "zone":
        return this.handleZoneAction(agentId, goal, rule, timestamp);
      case "simple":
        return { actionType: rule.action, agentId, timestamp };
      case "move":
        return this.handleMoveAction(agentId, goal, timestamp);
      default:
        return null;
    }
  }

  /**
   * Range-based: if within range → execute action, else MOVE
   */
  private handleRangeAction(
    agentId: string,
    goal: AIGoal,
    rule: { type: "range"; executeAction: ActionType; range: number },
    timestamp: number,
  ): AgentAction | null {
    if (!goal.targetPosition) {
      if (goal.targetZoneId) {
        return {
          actionType: ActionType.WORK,
          agentId,
          targetZoneId: goal.targetZoneId,
          timestamp,
        };
      }
      return { actionType: ActionType.IDLE, agentId, timestamp };
    }

    const agentPos = this.getPosition(agentId);
    if (!agentPos) return null;

    const dist = Math.hypot(
      agentPos.x - goal.targetPosition.x,
      agentPos.y - goal.targetPosition.y,
    );

    if (dist < rule.range) {
      return {
        actionType: rule.executeAction,
        agentId,
        targetId: goal.targetId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }

    return {
      actionType: ActionType.MOVE,
      agentId,
      targetPosition: goal.targetPosition,
      timestamp,
    };
  }

  /**
   * Zone-based: if inside zone → execute action, else MOVE to zone
   */
  private handleZoneAction(
    agentId: string,
    goal: AIGoal,
    rule: { type: "zone"; executeAction: ActionType; zoneTypes?: ZoneType[] },
    timestamp: number,
  ): AgentAction | null {
    const agentPos = this.getPosition(agentId);
    const zones = this.deps.gameState.zones ?? [];

    let targetZone = goal.targetZoneId
      ? zones.find((z) => z.id === goal.targetZoneId)
      : undefined;

    if (!targetZone && rule.zoneTypes?.length) {
      targetZone = zones.find((z) =>
        rule.zoneTypes!.includes(z.type as ZoneType),
      );
    }

    if (agentPos && targetZone?.bounds) {
      const inZone =
        agentPos.x >= targetZone.bounds.x &&
        agentPos.x <= targetZone.bounds.x + targetZone.bounds.width &&
        agentPos.y >= targetZone.bounds.y &&
        agentPos.y <= targetZone.bounds.y + targetZone.bounds.height;

      if (inZone) {
        return {
          actionType: rule.executeAction,
          agentId,
          targetZoneId: targetZone.id,
          timestamp,
          data: goal.data,
        };
      }
    }

    if (targetZone) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: targetZone.id,
        timestamp,
      };
    }

    if (goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }

    if (rule.executeAction === ActionType.SOCIALIZE) {
      return {
        actionType: ActionType.SOCIALIZE,
        agentId,
        timestamp,
      };
    }

    return null;
  }

  /**
   * Special handler for WORK goals with resource/task types.
   * Searches for nearest resource and moves/harvests accordingly.
   */
  private handleWork(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    const taskType = (goal.data?.taskType as string)?.toLowerCase();
    const resourceType = (goal.data?.resourceType as string)?.toLowerCase();

    if (goal.targetId && goal.targetPosition) {
      const agentPos = this.getPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - goal.targetPosition.x,
          agentPos.y - goal.targetPosition.y,
        );
        if (dist < HARVEST_RANGE) {
          return {
            actionType: ActionType.HARVEST,
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
        return {
          actionType: ActionType.MOVE,
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
        };
      }
    }

    if (goal.targetZoneId) {
      return {
        actionType: ActionType.WORK,
        agentId,
        targetZoneId: goal.targetZoneId,
        data: goal.data,
        timestamp,
      };
    }

    let searchTypes: string[] = [];
    if (taskType && TASK_SEARCH_MAP[taskType]) {
      searchTypes = TASK_SEARCH_MAP[taskType];
    } else if (resourceType && RESOURCE_SEARCH_MAP[resourceType]) {
      searchTypes = RESOURCE_SEARCH_MAP[resourceType];
    }

    if (searchTypes.length > 0 && this.deps.findNearestResource) {
      for (const searchType of searchTypes) {
        const resource = this.deps.findNearestResource(agentId, searchType);
        if (resource) {
          const agentPos = this.getPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - resource.x,
              agentPos.y - resource.y,
            );
            if (dist < HARVEST_RANGE) {
              return {
                actionType: ActionType.HARVEST,
                agentId,
                targetId: resource.id,
                targetPosition: { x: resource.x, y: resource.y },
                timestamp,
              };
            }
            return {
              actionType: ActionType.MOVE,
              agentId,
              targetPosition: { x: resource.x, y: resource.y },
              timestamp,
            };
          }
        }
      }
    }

    if (
      (taskType === "gather_food" || resourceType === "food") &&
      this.deps.findNearestHuntableAnimal
    ) {
      const animal = this.deps.findNearestHuntableAnimal(agentId);
      if (animal) {
        const agentPos = this.getPosition(agentId);
        if (agentPos) {
          const dist = Math.hypot(agentPos.x - animal.x, agentPos.y - animal.y);
          if (dist < ATTACK_RANGE) {
            return {
              actionType: ActionType.ATTACK,
              agentId,
              targetId: animal.id,
              timestamp,
            };
          }
          return {
            actionType: ActionType.MOVE,
            agentId,
            targetPosition: { x: animal.x, y: animal.y },
            timestamp,
          };
        }
      }
    }

    return null;
  }

  /**
   * Move-only: just return MOVE to target
   */
  private handleMoveAction(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    if (goal.targetZoneId) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    return null;
  }

  /**
   * Special handler for HUNT (needs weapon check, animal tracking)
   */
  private handleHunt(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    const hasWeapon = this.deps.agentHasWeapon?.(agentId) ?? false;
    if (!hasWeapon) {
      const claimed = this.deps.tryClaimWeapon?.(agentId) ?? false;
      if (!claimed) {
        logger.debug(`🎯 [Hunt] ${agentId}: No weapon available, cannot hunt`);
        return null;
      }
    }

    let targetId = goal.targetId;
    let targetPosition = goal.targetPosition;

    if (targetId && this.deps.getAnimalPosition) {
      const currentPos = this.deps.getAnimalPosition(targetId);
      if (currentPos) {
        targetPosition = currentPos;
      } else {
        targetId = undefined;
        targetPosition = undefined;
      }
    }

    if (!targetId && this.deps.findNearestHuntableAnimal) {
      const nearest = this.deps.findNearestHuntableAnimal(agentId);
      if (nearest) {
        targetId = nearest.id;
        targetPosition = { x: nearest.x, y: nearest.y };
      }
    }

    if (targetId && targetPosition) {
      const agentPos = this.getPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - targetPosition.x,
          agentPos.y - targetPosition.y,
        );
        const attackRange =
          this.deps.getAgentAttackRange?.(agentId) ?? ATTACK_RANGE;

        if (dist < attackRange) {
          return {
            actionType: ActionType.ATTACK,
            agentId,
            targetId,
            timestamp,
          };
        }
        return {
          actionType: ActionType.MOVE,
          agentId,
          targetPosition,
          timestamp,
        };
      }
    }

    return this.handleExplore(agentId, goal, timestamp);
  }

  /**
   * Special handler for EXPLORE (random position generation)
   */
  private handleExplore(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.data?.targetRegionX !== undefined) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: {
          x: goal.data.targetRegionX as number,
          y: goal.data.targetRegionY as number,
        },
        timestamp,
      };
    }
    if (goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }

    const currentPos = this.getPosition(agentId);
    if (!currentPos) return null;

    const mapWidth = this.deps.gameState.worldSize?.width ?? 2000;
    const mapHeight = this.deps.gameState.worldSize?.height ?? 2000;

    const isDesperate = goal.data?.explorationType === "desperate_search";
    let targetX: number;
    let targetY: number;

    if (isDesperate) {
      targetX = Math.random() * mapWidth;
      targetY = Math.random() * mapHeight;
    } else {
      targetX = currentPos.x + (Math.random() - 0.5) * EXPLORE_RANGE;
      targetY = currentPos.y + (Math.random() - 0.5) * EXPLORE_RANGE;
    }

    targetX = Math.max(50, Math.min(mapWidth - 50, targetX));
    targetY = Math.max(50, Math.min(mapHeight - 50, targetY));

    return {
      actionType: ActionType.MOVE,
      agentId,
      targetPosition: { x: targetX, y: targetY },
      timestamp,
    };
  }
}
