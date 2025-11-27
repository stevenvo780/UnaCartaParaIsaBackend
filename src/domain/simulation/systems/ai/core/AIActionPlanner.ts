import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AgentAction } from "../../../../types/simulation/ai";
import { ActionType } from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";

export interface AIActionPlannerDeps {
  gameState: GameState;
  getAgentPosition: (agentId: string) => { x: number; y: number } | null;
  /** Find nearest resource of a given type */
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  /** Find nearest huntable animal */
  findNearestHuntableAnimal?: (
    entityId: string,
  ) => { id: string; x: number; y: number; type: string } | null;
}

import { logger } from "../../../../../infrastructure/utils/logger";

/**
 * Plans concrete actions for AI goals.
 * Converts high-level goals into executable actions (move, harvest, attack, etc.).
 */
export class AIActionPlanner {
  private readonly deps: AIActionPlannerDeps;

  private readonly HARVEST_RANGE = 80; // Increased from 60 for more reliable harvesting
  private readonly ATTACK_RANGE = 50; // Increased from 40
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
        return { actionType: ActionType.IDLE, agentId, timestamp };

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
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    if (goal.data?.need === "energy") {
      return { actionType: ActionType.IDLE, agentId, timestamp };
    }
    return null;
  }

  private planSatisfyHunger(
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
            actionType: ActionType.HARVEST,
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
      }
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    return { actionType: ActionType.IDLE, agentId, timestamp };
  }

  private planSatisfyThirst(
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
            actionType: ActionType.HARVEST,
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
      }
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }
    return { actionType: ActionType.IDLE, agentId, timestamp };
  }

  private planSatisfyEnergy(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    const agentPos = this.deps.getAgentPosition(agentId);

    const currentRestZone = this.deps.gameState.zones?.find((z) => {
      if (
        z.type !== ZoneType.REST &&
        z.type !== ZoneType.BEDROOM &&
        z.type !== ZoneType.SHELTER
      ) {
        return false;
      }
      if (!agentPos || !z.bounds) return false;
      return (
        agentPos.x >= z.bounds.x &&
        agentPos.x <= z.bounds.x + z.bounds.width &&
        agentPos.y >= z.bounds.y &&
        agentPos.y <= z.bounds.y + z.bounds.height
      );
    });

    if (currentRestZone) {
      // Already in rest zone, sleep!
      return {
        actionType: ActionType.SLEEP,
        agentId,
        targetZoneId: currentRestZone.id,
        timestamp,
      };
    }

    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: goal.targetZoneId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }

    const restZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === ZoneType.REST ||
        z.type === ZoneType.BEDROOM ||
        z.type === ZoneType.SHELTER,
    );
    if (restZone) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: restZone.id,
        timestamp,
      };
    }

    return { actionType: ActionType.IDLE, agentId, timestamp };
  }

  private planSatisfySocial(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    const agentPos = this.deps.getAgentPosition(agentId);

    const currentZone = this.deps.gameState.zones?.find((z) => {
      if (
        z.type !== "social" &&
        z.type !== "gathering" &&
        z.type !== "market" &&
        z.type !== "tavern"
      ) {
        return false;
      }
      if (!agentPos || !z.bounds) return false;
      return (
        agentPos.x >= z.bounds.x &&
        agentPos.x <= z.bounds.x + z.bounds.width &&
        agentPos.y >= z.bounds.y &&
        agentPos.y <= z.bounds.y + z.bounds.height
      );
    });

    if (currentZone) {
      // Already in social zone, socialize!
      return {
        actionType: ActionType.SOCIALIZE,
        agentId,
        targetZoneId: currentZone.id,
        timestamp,
      };
    }

    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
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
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: socialZone.id,
        timestamp,
      };
    }

    return {
      actionType: ActionType.SOCIALIZE,
      agentId,
      timestamp,
    };
  }

  private planSatisfyFun(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId || goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
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
        actionType: ActionType.MOVE,
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
          logger.debug(
            `🌾 [ActionPlanner] ${agentId}: HARVEST (dist=${dist.toFixed(0)} < ${this.HARVEST_RANGE})`,
          );
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
    const taskType = goal.data?.taskType as string | undefined;
    const resourceType = goal.data?.resourceType as string | undefined;

    if (goal.targetId && goal.targetPosition) {
      const agentPos = this.deps.getAgentPosition(agentId);
      if (agentPos) {
        const dist = Math.hypot(
          agentPos.x - goal.targetPosition.x,
          agentPos.y - goal.targetPosition.y,
        );

        if (dist < this.HARVEST_RANGE) {
          logger.debug(
            `🌾 [Work] ${agentId}: HARVEST goal target (dist=${dist.toFixed(0)})`,
          );
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

    if (
      taskType === "gather_food" ||
      (resourceType === "food" && !goal.targetId)
    ) {
      const foodTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];

      if (this.deps.findNearestResource) {
        for (const foodType of foodTypes) {
          const resource = this.deps.findNearestResource(agentId, foodType);
          if (resource) {
            const agentPos = this.deps.getAgentPosition(agentId);
            if (agentPos) {
              const dist = Math.hypot(
                agentPos.x - resource.x,
                agentPos.y - resource.y,
              );
              if (dist < this.HARVEST_RANGE) {
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

      if (this.deps.findNearestHuntableAnimal) {
        const animal = this.deps.findNearestHuntableAnimal(agentId);
        if (animal) {
          const agentPos = this.deps.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - animal.x,
              agentPos.y - animal.y,
            );
            if (dist < this.ATTACK_RANGE) {
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
    }

    if (
      taskType === "gather_water" ||
      (resourceType === "water" && !goal.targetId)
    ) {
      if (this.deps.findNearestResource) {
        const waterSource = this.deps.findNearestResource(
          agentId,
          "water_source",
        );
        if (waterSource) {
          const agentPos = this.deps.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - waterSource.x,
              agentPos.y - waterSource.y,
            );
            if (dist < this.HARVEST_RANGE) {
              return {
                actionType: ActionType.HARVEST,
                agentId,
                targetId: waterSource.id,
                targetPosition: { x: waterSource.x, y: waterSource.y },
                timestamp,
              };
            }
            return {
              actionType: ActionType.MOVE,
              agentId,
              targetPosition: { x: waterSource.x, y: waterSource.y },
              timestamp,
            };
          }
        }
      }
    }

    if (taskType === "gather_wood" || resourceType === "wood") {
      if (this.deps.findNearestResource) {
        const tree = this.deps.findNearestResource(agentId, "tree");
        if (tree) {
          const agentPos = this.deps.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(agentPos.x - tree.x, agentPos.y - tree.y);
            if (dist < this.HARVEST_RANGE) {
              return {
                actionType: ActionType.HARVEST,
                agentId,
                targetId: tree.id,
                targetPosition: { x: tree.x, y: tree.y },
                timestamp,
              };
            }
            return {
              actionType: ActionType.MOVE,
              agentId,
              targetPosition: { x: tree.x, y: tree.y },
              timestamp,
            };
          }
        }
      }
    }

    if (taskType === "gather_stone" || resourceType === "stone") {
      if (this.deps.findNearestResource) {
        const rock = this.deps.findNearestResource(agentId, "rock");
        if (rock) {
          const agentPos = this.deps.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(agentPos.x - rock.x, agentPos.y - rock.y);
            if (dist < this.HARVEST_RANGE) {
              return {
                actionType: ActionType.HARVEST,
                agentId,
                targetId: rock.id,
                targetPosition: { x: rock.x, y: rock.y },
                timestamp,
              };
            }
            return {
              actionType: ActionType.MOVE,
              agentId,
              targetPosition: { x: rock.x, y: rock.y },
              timestamp,
            };
          }
        }
      }
    }

    return null;
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
      actionType: ActionType.MOVE,
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
    const agentPos = this.deps.getAgentPosition(agentId);

    let targetZoneId = goal.targetZoneId;
    if (!targetZoneId) {
      const storageZone = this.deps.gameState.zones?.find(
        (z) => z.type === ZoneType.STORAGE,
      );
      const workZone = this.deps.gameState.zones?.find(
        (z) => z.type === ZoneType.WORK,
      );
      targetZoneId = storageZone?.id ?? workZone?.id;
      if (!targetZoneId) {
        return null; // No suitable zone available
      }
    }

    const zone = this.deps.gameState.zones?.find((z) => z.id === targetZoneId);

    if (agentPos && zone?.bounds) {
      const inZone =
        agentPos.x >= zone.bounds.x &&
        agentPos.x <= zone.bounds.x + zone.bounds.width &&
        agentPos.y >= zone.bounds.y &&
        agentPos.y <= zone.bounds.y + zone.bounds.height;

      if (inZone) {
        return {
          actionType: ActionType.DEPOSIT,
          agentId,
          targetZoneId,
          timestamp,
        };
      }
    }

    return {
      actionType: ActionType.MOVE,
      agentId,
      targetZoneId,
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
        actionType: ActionType.MOVE,
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
            actionType: ActionType.ATTACK,
            agentId,
            targetId: goal.targetId,
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
    return null;
  }

  private planAssist(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    if (goal.targetZoneId) {
      return {
        actionType: ActionType.SOCIALIZE,
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
    const agentPos = this.deps.getAgentPosition(agentId);

    const currentZone = this.deps.gameState.zones?.find((z) => {
      if (
        z.type !== "social" &&
        z.type !== "gathering" &&
        z.type !== "market" &&
        z.type !== "tavern" &&
        z.type !== "temple" &&
        z.type !== "sanctuary"
      ) {
        return false;
      }
      if (!agentPos || !z.bounds) return false;
      return (
        agentPos.x >= z.bounds.x &&
        agentPos.x <= z.bounds.x + z.bounds.width &&
        agentPos.y >= z.bounds.y &&
        agentPos.y <= z.bounds.y + z.bounds.height
      );
    });

    if (currentZone) {
      // Already in zone, socialize!
      return {
        actionType: ActionType.SOCIALIZE,
        agentId,
        targetZoneId: currentZone.id,
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
    if (goal.targetPosition) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetPosition: goal.targetPosition,
        timestamp,
      };
    }

    const socialZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "social" ||
        z.type === "gathering" ||
        z.type === "market" ||
        z.type === "temple" ||
        z.type === "sanctuary",
    );
    if (socialZone) {
      return {
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: socialZone.id,
        timestamp,
      };
    }

    return {
      actionType: ActionType.SOCIALIZE,
      agentId,
      timestamp,
    };
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
    const currentPos = this.deps.getAgentPosition(agentId);
    if (currentPos) {
      const mapWidth = this.deps.gameState.worldSize?.width || 2000;
      const mapHeight = this.deps.gameState.worldSize?.height || 2000;
      let targetX: number;
      let targetY: number;

      if (goal.data?.explorationType === "desperate_search") {
        // For desperate search, pick a completely random point on the map
        targetX = Math.random() * mapWidth;
        targetY = Math.random() * mapHeight;
      } else {
        // Normal exploration is local
        targetX = currentPos.x + (Math.random() - 0.5) * this.EXPLORE_RANGE;
        targetY = currentPos.y + (Math.random() - 0.5) * this.EXPLORE_RANGE;
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
    return null;
  }

  private planConstruction(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    return {
      actionType: ActionType.WORK,
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
        actionType: ActionType.MOVE,
        agentId,
        targetZoneId: goal.targetZoneId,
        timestamp,
      };
    }
    return { actionType: ActionType.IDLE, agentId, timestamp };
  }

  private planInspect(
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

  private planHunt(
    agentId: string,
    goal: AIGoal,
    timestamp: number,
  ): AgentAction | null {
    let targetId = goal.targetId;
    let targetPosition = goal.targetPosition;

    if (!targetId && this.deps.gameState.animals?.animals) {
      const agentPos = this.deps.getAgentPosition(agentId);
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
        if (dist < this.ATTACK_RANGE) {
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

    return this.planExplore(agentId, goal, timestamp);
  }
}
