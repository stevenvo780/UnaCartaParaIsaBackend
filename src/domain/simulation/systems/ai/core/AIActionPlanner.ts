import { logger } from "../../../../../infrastructure/utils/logger";
import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AgentAction } from "../../../../types/simulation/ai";

export interface AIActionPlannerDeps {
  gameState: GameState;
  getAgentPosition: (agentId: string) => { x: number; y: number } | null;
}

/**
 * Plans concrete actions for AI goals.
 * Converts high-level goals into executable actions (move, harvest, attack, etc.).
 */
export class AIActionPlanner {
  private readonly deps: AIActionPlannerDeps;

  private readonly HARVEST_RANGE = 60;
  private readonly ATTACK_RANGE = 40;
  private readonly EXPLORE_RANGE = 200;

  constructor(deps: AIActionPlannerDeps) {
    this.deps = deps;
  }

  /**
   * Plans an action for a given goal.
   */
  public planAction(agentId: string, goal: AIGoal): AgentAction | null {
    const timestamp = Date.now();

    switch (goal.type) {
      case "satisfy_need":
        return this.planSatisfyNeed(agentId, goal, timestamp);

      case "satisfy_hunger":
        return this.planSatisfyHunger(agentId, goal, timestamp);

      case "satisfy_thirst":
        return this.planSatisfyThirst(agentId, goal, timestamp);

      case "satisfy_energy":
        return this.planSatisfyEnergy(agentId, goal, timestamp);

      case "satisfy_social":
        return this.planSatisfySocial(agentId, goal, timestamp);

      case "satisfy_fun":
        return this.planSatisfyFun(agentId, goal, timestamp);

      case "gather":
        return this.planGather(agentId, goal, timestamp);

      case "work":
        return this.planWork(agentId, goal, timestamp);

      case "craft":
        return this.planCraft(agentId, goal, timestamp);

      case "deposit":
        return this.planDeposit(agentId, goal, timestamp);

      case "flee":
        return this.planFlee(agentId, goal, timestamp);

      case "attack":
      case "combat":
        return this.planCombat(agentId, goal, timestamp);

      case "assist":
        return this.planAssist(agentId, goal, timestamp);

      case "social":
        return this.planSocial(agentId, goal, timestamp);

      case "explore":
        return this.planExplore(agentId, goal, timestamp);

      case "construction":
        return this.planConstruction(agentId, goal, timestamp);

      case "idle":
        return { actionType: "idle", agentId, timestamp };

      case "rest":
        return this.planRest(agentId, goal, timestamp);

      case "inspect":
        return this.planInspect(agentId, goal, timestamp);

      case "hunt":
        return this.planHunt(agentId, goal, timestamp);

      default:
        return null;
    }
  }

  private planSatisfyNeed(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetId && goal.targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - goal.targetPosition.x,
          agentPos.y - goal.targetPosition.y,
        );
        if (dist < this.HARVEST_RANGE) {
          return {
            actionType: "harvest",
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
        return {
          actionType: "move",
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
        };
      }
    }
    if (goal.targetZoneId) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    if (goal.data?.need === "energy") {
      return { actionType: "idle", agentId, timestamp };
    }
    return null;
  }

  private planSatisfyHunger(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const foodZone = this.deps.gameState.zones?.find(
      (z) => z.type === "food" || z.type === "kitchen",
    );
    if (foodZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: foodZone.id,
        timestamp,
      };
    }
    return null;
  }

  private planSatisfyThirst(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const waterZone = this.deps.gameState.zones?.find(
      (z) => z.type === "water" || z.type === "well",
    );
    if (waterZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: waterZone.id,
        timestamp,
      };
    }
    return null;
  }

  private planSatisfyEnergy(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const restZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "rest" ||
        z.type === "bed" ||
        z.type === "shelter" ||
        z.type === "house",
    );
    if (restZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: restZone.id,
        timestamp,
      };
    }
    return { actionType: "idle", agentId, timestamp };
  }

  private planSatisfySocial(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const socialZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "social" ||
        z.type === "gathering" ||
        z.type === "market" ||
        z.type === "tavern",
    );
    if (socialZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: socialZone.id,
        timestamp,
      };
    }
    return null;
  }

  private planSatisfyFun(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const funZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "entertainment" ||
        z.type === "tavern" ||
        z.type === "market" ||
        z.type === "gathering",
    );
    if (funZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: funZone.id,
        timestamp,
      };
    }
    return null;
  }

  private planGather(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetId && goal.targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - goal.targetPosition.x,
          agentPos.y - goal.targetPosition.y,
        );
        if (dist < this.HARVEST_RANGE) {
          return {
            actionType: "harvest",
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
        return {
          actionType: "move",
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
        };
      }
    }
    if (goal.targetZoneId) {
      return {
        actionType: "work",
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    return null;
  }

  private planWork(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (!goal.targetZoneId) {
      return null;
    }
    return {
      actionType: "work",
      agentId,
      targetZoneId: goal.targetZoneId,
      data: goal.data,
      timestamp,
    };
  }

  private planCraft(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (!goal.targetZoneId) {
      return null;
    }
    return {
      actionType: "move",
      agentId,
      targetZoneId: goal.targetZoneId,
      timestamp,
    };
  }

  private planDeposit(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (!goal.targetZoneId) {
      return null;
    }
    return {
      actionType: "move",
      agentId,
      targetZoneId: goal.targetZoneId,
      timestamp,
    };
  }

  private planFlee(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    return null;
  }

  private planCombat(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetId && goal.targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - goal.targetPosition.x,
          agentPos.y - goal.targetPosition.y,
        );
        if (dist < this.ATTACK_RANGE) {
          return {
            actionType: "attack",
            agentId,
            targetId: goal.targetId,
            timestamp,
          };
        }
        return {
          actionType: "move",
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
        };
      }
    }
    return null;
  }

  private planAssist(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId) {
      return {
        actionType: "socialize",
        agentId,
        targetZoneId: goal.targetZoneId,
        targetId: goal.data?.targetAgentId as string | undefined,
        timestamp,
      };
    }
    return null;
  }

  private planSocial(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    if (goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const socialZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "social" || z.type === "gathering" || z.type === "market",
    );
    if (socialZone) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: socialZone.id,
        timestamp,
      };
    }
    return null;
  }

  private planExplore(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (
      goal.data?.targetRegionX !== undefined &&
      goal.data?.targetRegionY !== undefined
    ) {
      return {
        actionType: "move",
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
        actionType: "move",
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    const currentPos = this.deps.getAgentPosition(agentId);
    if (currentPos) {
      const mapWidth = this.deps.gameState.worldSize?.width || 2000;
      const mapHeight = this.deps.gameState.worldSize?.height || 2000;
      let targetX = currentPos.x + (Math.random() - 0.5) * this.EXPLORE_RANGE;
      let targetY = currentPos.y + (Math.random() - 0.5) * this.EXPLORE_RANGE;
      targetX = Math.max(50, Math.min(mapWidth - 50, targetX));
      targetY = Math.max(50, Math.min(mapHeight - 50, targetY));

      return {
        actionType: "move",
        agentId,
        targetPosition: { x: targetX, y: targetY },
        timestamp,
      };
    }
    return null;
  }

  private planConstruction(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    return {
      actionType: "work",
      agentId,
      targetZoneId: goal.targetZoneId,
      data: { ...goal.data, workType: "construction" },
      timestamp,
    };
  }

  private planRest(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    return { actionType: "idle", agentId, timestamp };
  }

  private planInspect(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetPosition) {
      return {
        actionType: "move",
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    if (goal.targetZoneId) {
      return {
        actionType: "move",
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    return null;
  }

  private planHunt(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    let targetId = goal.targetId;
    let targetPosition = goal.targetPosition;

    // If no target, try to find nearest animal
    if (!targetId && this.deps.gameState.animals?.animals) {
      const agentPos = this.deps.getAgentPosition(agentId);
      logger.info(`[AIActionPlanner] planHunt: animals=${this.deps.gameState.animals.animals.length}`);
      if (agentPos) {
        let minDist = Infinity;
        let nearestAnimal = null;

        for (const animal of this.deps.gameState.animals.animals) {
          if (animal.isDead) continue;
          const dist = Math.hypot(
            agentPos.x - animal.position.x,
            agentPos.y - animal.position.y,
          );
          if (dist < minDist && dist < this.EXPLORE_RANGE * 2) {
            minDist = dist;
            nearestAnimal = animal;
          }
        }

        if (nearestAnimal) {
          targetId = nearestAnimal.id;
          targetPosition = nearestAnimal.position;
          logger.info(`[AIActionPlanner] Found prey ${targetId} at dist ${minDist}`);
        } else {
          logger.info(`[AIActionPlanner] No prey found within range`);
        }
      }
    }

    if (targetId && targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - targetPosition.x,
          agentPos.y - targetPosition.y,
        );
        logger.info(`[AIActionPlanner] Dist to prey: ${dist}, AttackRange: ${this.ATTACK_RANGE}`);
        if (dist < this.ATTACK_RANGE) {
          return {
            actionType: "attack",
            agentId,
            targetId,
            timestamp,
          };
        }
        return {
          actionType: "move",
          agentId,
          targetPosition,
          timestamp,
        };
      }
    }

    // If still no target, explore
    return this.planExplore(agentId, goal, timestamp);
  }
}
