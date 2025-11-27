import type { GameState } from "../../../../types/game-types";
import type { AIGoal } from "../../../../types/simulation/ai";

export interface AIUrgentGoalsDeps {
  gameState: GameState;
  getAgentPosition: (agentId: string) => { x: number; y: number } | null;
  findNearestResourceForEntity: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
}

/**
 * Creates urgent goals for critical agent needs.
 * Handles food, water, rest, social, and fun urgencies.
 */
export class AIUrgentGoals {
  private readonly deps: AIUrgentGoalsDeps;

  constructor(deps: AIUrgentGoalsDeps) {
    this.deps = deps;
  }

  /**
   * Creates urgent food goal when hunger is critical.
   */
  public createUrgentFoodGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.getAgentPosition(agentId);
    if (!position) return null;

    // Food is only obtained from world resources - no zones satisfy hunger directly
    // Zones like farms/kitchens PRODUCE food items, but agents must gather from resources
    const foodResourceTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];
    for (const resourceType of foodResourceTypes) {
      const nearestFood = this.deps.findNearestResourceForEntity(
        agentId,
        resourceType,
      );
      if (nearestFood) {
        return {
          id: `urgent-gather-${agentId}-${now}`,
          type: "gather",
          priority: 10,
          targetId: nearestFood.id,
          targetPosition: { x: nearestFood.x, y: nearestFood.y },
          createdAt: now,
          data: { resourceType, need: "hunger" },
        };
      }
    }

    return null;
  }

  /**
   * Creates urgent water goal when thirst is critical.
   */
  public createUrgentWaterGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.getAgentPosition(agentId);
    if (!position) return null;

    // Water is only obtained from world resources - no zones satisfy thirst directly
    // Zones like wells PRODUCE water items, but agents must gather from water_source resources
    const nearestWater = this.deps.findNearestResourceForEntity(
      agentId,
      "water_source",
    );
    if (nearestWater) {
      return {
        id: `urgent-gather-water-${agentId}-${now}`,
        type: "gather",
        priority: 10,
        targetId: nearestWater.id,
        targetPosition: { x: nearestWater.x, y: nearestWater.y },
        createdAt: now,
        data: { resourceType: "water_source", need: "thirst" },
      };
    }

    return null;
  }

  /**
   * Creates urgent rest goal when energy is critical.
   */
  public createUrgentRestGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.getAgentPosition(agentId);
    if (!position) return null;

    const restZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "rest" ||
        z.type === "bed" ||
        z.type === "shelter" ||
        z.type === "house",
    );

    if (restZone?.bounds) {
      return {
        id: `urgent-rest-${agentId}-${now}`,
        type: "satisfy_energy",
        priority: 10,
        targetZoneId: restZone.id,
        createdAt: now,
        data: { need: "energy" },
      };
    }

    return {
      id: `urgent-rest-idle-${agentId}-${now}`,
      type: "satisfy_energy",
      priority: 9,
      createdAt: now,
      data: { need: "energy" },
    };
  }

  /**
   * Creates urgent social goal when social need is critical.
   */
  public createUrgentSocialGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.getAgentPosition(agentId);
    if (!position) return null;

    const socialZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "social" ||
        z.type === "gathering" ||
        z.type === "market" ||
        z.type === "tavern",
    );

    if (socialZone?.bounds) {
      return {
        id: `urgent-social-${agentId}-${now}`,
        type: "satisfy_social",
        priority: 9,
        targetZoneId: socialZone.id,
        createdAt: now,
        data: { need: "social" },
      };
    }

    return null;
  }

  /**
   * Creates urgent fun goal when fun need is critical.
   */
  public createUrgentFunGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.getAgentPosition(agentId);
    if (!position) return null;

    const funZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === "entertainment" ||
        z.type === "tavern" ||
        z.type === "market" ||
        z.type === "gathering",
    );

    if (funZone?.bounds) {
      return {
        id: `urgent-fun-${agentId}-${now}`,
        type: "satisfy_fun",
        priority: 8,
        targetZoneId: funZone.id,
        createdAt: now,
        data: { need: "fun" },
      };
    }

    return null;
  }
}
