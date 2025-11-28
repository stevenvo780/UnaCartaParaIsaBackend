import type { GameState } from "../../../../types/game-types";
import type { AIGoal, AgentAction } from "../../../../types/simulation/ai";
import {
  ActionType,
  GoalType,
  NeedType,
} from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";
import { TaskType } from "../../../../../shared/constants/TaskEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";
import { ExplorationType } from "../../../../../shared/constants/AgentEnums";
import type { AgentRegistry } from "../../../core/AgentRegistry";

export interface AIActionPlannerDeps {
  gameState: GameState;
  agentRegistry: AgentRegistry;
  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  findNearestHuntableAnimal?: (
    entityId: string,
  ) => { id: string; x: number; y: number; type: string } | null;
  /**
   * Gets the current position of an animal by ID.
   * Used by planHunt to track moving animals instead of using stale goal positions.
   */
  getAnimalPosition?: (animalId: string) => { x: number; y: number } | null;
}

import { logger } from "../../../../../infrastructure/utils/logger";

/**
 * Plans concrete actions for AI goals.
 * Converts high-level goals into executable actions (move, harvest, attack, etc.).
 */
export class AIActionPlanner {
  private readonly deps: AIActionPlannerDeps;

  private readonly HARVEST_RANGE = 80;
  private readonly ATTACK_RANGE = 50;
  private readonly EXPLORE_RANGE = 200;

  constructor(deps: AIActionPlannerDeps) {
    this.deps = deps;
  }

  /** O(1) position lookup via AgentRegistry */
  private getPosition(agentId: string): { x: number; y: number } | null {
    return this.deps.agentRegistry.getPosition(agentId) ?? null;
  }

  /**
   * Plans an action for a given goal.
   */
  public planAction(agentId: string, goal: AIGoal): AgentAction | null {
    const timestamp = Date.now();

    switch (goal.type) {
      case GoalType.SATISFY_NEED:
        return this.planSatisfyNeed(agentId, goal, timestamp);

      case GoalType.SATISFY_HUNGER:
        return this.planSatisfyHunger(agentId, goal, timestamp);

      case GoalType.SATISFY_THIRST:
        return this.planSatisfyThirst(agentId, goal, timestamp);

      case GoalType.SATISFY_ENERGY:
        return this.planSatisfyEnergy(agentId, goal, timestamp);

      case GoalType.SATISFY_SOCIAL:
        return this.planSatisfySocial(agentId, goal, timestamp);

      case GoalType.SATISFY_FUN:
        return this.planSatisfyFun(agentId, goal, timestamp);

      case GoalType.GATHER:
        return this.planGather(agentId, goal, timestamp);

      case GoalType.WORK:
        return this.planWork(agentId, goal, timestamp);

      case GoalType.CRAFT:
        return this.planCraft(agentId, goal, timestamp);

      case GoalType.DEPOSIT:
        return this.planDeposit(agentId, goal, timestamp);

      case GoalType.FLEE:
        return this.planFlee(agentId, goal, timestamp);

      case GoalType.ATTACK:
      case GoalType.COMBAT:
        return this.planCombat(agentId, goal, timestamp);

      case GoalType.ASSIST:
        return this.planAssist(agentId, goal, timestamp);

      case GoalType.SOCIAL:
        return this.planSocial(agentId, goal, timestamp);

      case GoalType.EXPLORE:
        return this.planExplore(agentId, goal, timestamp);

      case GoalType.CONSTRUCTION:
        return this.planConstruction(agentId, goal, timestamp);

      case GoalType.IDLE:
        return { actionType: ActionType.IDLE, agentId, timestamp };

      case GoalType.REST:
        return this.planRest(agentId, goal, timestamp);

      case GoalType.INSPECT:
        return this.planInspect(agentId, goal, timestamp);

      case GoalType.HUNT:
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
      const agentPos = this.getPosition(agentId);
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
    if (goal.data?.need === NeedType.ENERGY) {
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
      const agentPos = this.getPosition(agentId);
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
      const agentPos = this.getPosition(agentId);
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
    const agentPos = this.getPosition(agentId);

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
    const agentPos = this.getPosition(agentId);

    const currentZone = this.deps.gameState.zones?.find((z) => {
      if (
        z.type !== ZoneType.SOCIAL &&
        z.type !== ZoneType.GATHERING &&
        z.type !== ZoneType.MARKET &&
        z.type !== ZoneType.TAVERN
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
        z.type === ZoneType.SOCIAL ||
        z.type === ZoneType.GATHERING ||
        z.type === ZoneType.MARKET ||
        z.type === ZoneType.TAVERN,
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
        z.type === ZoneType.ENTERTAINMENT ||
        z.type === ZoneType.TAVERN ||
        z.type === ZoneType.MARKET ||
        z.type === ZoneType.GATHERING,
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
      const agentPos = this.getPosition(agentId);
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
      const agentPos = this.getPosition(agentId);
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
      taskType === TaskType.GATHER_FOOD ||
      (resourceType === ResourceType.FOOD && !goal.targetId)
    ) {
      const foodTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];

      if (this.deps.findNearestResource) {
        for (const foodType of foodTypes) {
          const resource = this.deps.findNearestResource(agentId, foodType);
          if (resource) {
            const agentPos = this.getPosition(agentId);
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
          const agentPos = this.getPosition(agentId);
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
      taskType === TaskType.GATHER_WATER ||
      (resourceType === ResourceType.WATER && !goal.targetId)
    ) {
      if (this.deps.findNearestResource) {
        const waterSource = this.deps.findNearestResource(
          agentId,
          "water_source",
        );
        if (waterSource) {
          const agentPos = this.getPosition(agentId);
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

    if (
      taskType === TaskType.GATHER_WOOD ||
      resourceType === ResourceType.WOOD
    ) {
      if (this.deps.findNearestResource) {
        const tree = this.deps.findNearestResource(agentId, "tree");
        if (tree) {
          const agentPos = this.getPosition(agentId);
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

    if (
      taskType === TaskType.GATHER_STONE ||
      resourceType === ResourceType.STONE
    ) {
      if (this.deps.findNearestResource) {
        const rock = this.deps.findNearestResource(agentId, "rock");
        if (rock) {
          const agentPos = this.getPosition(agentId);
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

    if (
      taskType === TaskType.GATHER_METAL ||
      resourceType === ResourceType.METAL ||
      resourceType === ResourceType.IRON_ORE ||
      resourceType === ResourceType.COPPER_ORE
    ) {
      if (this.deps.findNearestResource) {
        const rock = this.deps.findNearestResource(agentId, "rock");
        if (rock) {
          const agentPos = this.getPosition(agentId);
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
    const agentPos = this.getPosition(agentId);

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
        return null;
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
      const agentPos = this.getPosition(agentId);
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
    const agentPos = this.getPosition(agentId);

    const currentZone = this.deps.gameState.zones?.find((z) => {
      if (
        z.type !== ZoneType.SOCIAL &&
        z.type !== ZoneType.GATHERING &&
        z.type !== ZoneType.MARKET &&
        z.type !== ZoneType.TAVERN &&
        z.type !== ZoneType.TEMPLE &&
        z.type !== ZoneType.SANCTUARY
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
        z.type === ZoneType.SOCIAL ||
        z.type === ZoneType.GATHERING ||
        z.type === ZoneType.MARKET ||
        z.type === ZoneType.TEMPLE ||
        z.type === ZoneType.SANCTUARY,
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
    const currentPos = this.getPosition(agentId);
    if (currentPos) {
      const mapWidth = this.deps.gameState.worldSize?.width || 2000;
      const mapHeight = this.deps.gameState.worldSize?.height || 2000;
      let targetX: number;
      let targetY: number;

      if (goal.data?.explorationType === ExplorationType.DESPERATE_SEARCH) {
        targetX = Math.random() * mapWidth;
        targetY = Math.random() * mapHeight;
      } else {
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

    if (targetId && this.deps.getAnimalPosition) {
      const currentPos = this.deps.getAnimalPosition(targetId);
      if (currentPos) {
        targetPosition = currentPos;
        logger.debug(
          `🎯 [Hunt] ${agentId}: Updated target position for ${targetId} to (${Math.round(currentPos.x)}, ${Math.round(currentPos.y)})`,
        );
      } else {
        logger.debug(
          `🎯 [Hunt] ${agentId}: Target ${targetId} not found, searching for new prey`,
        );
        targetId = undefined;
        targetPosition = undefined;
      }
    }

    if (!targetId && this.deps.findNearestHuntableAnimal) {
      const nearestAnimal = this.deps.findNearestHuntableAnimal(agentId);
      if (nearestAnimal) {
        targetId = nearestAnimal.id;
        targetPosition = { x: nearestAnimal.x, y: nearestAnimal.y };
      }
    }

    if (targetId && targetPosition) {
      const agentPos = this.getPosition(agentId);
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
