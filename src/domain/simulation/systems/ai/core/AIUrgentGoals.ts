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

    // Find nearest food zone
    const foodZone = this.deps.gameState.zones?.find(
      (z) => z.type === "food" || z.type === "kitchen",
    );

    if (foodZone?.bounds) {
      return {
        id: `urgent-food-${agentId}-${now}`,
        type: "satisfy_hunger",
        priority: 10,
        targetZoneId: foodZone.id,
        createdAt: now,
        data: { need: "hunger" },
      };
    }

    // Fallback: look for nearest food resource
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
          targetPosition: nearestFood,
          createdAt: now,
          data: { resourceType },
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

    const waterZone = this.deps.gameState.zones?.find(
      (z) => z.type === "water" || z.type === "well",
    );

    if (waterZone?.bounds) {
      return {
        id: `urgent-water-${agentId}-${now}`,
        type: "satisfy_thirst",
        priority: 10,
        targetZoneId: waterZone.id,
        createdAt: now,
        data: { need: "thirst" },
      };
    }

    // Fallback: look for nearest water resource
    const nearestWater = this.deps.findNearestResourceForEntity(
      agentId,
      "water_source",
    );
    if (nearestWater) {
      return {
        id: `urgent-gather-water-${agentId}-${now}`,
        type: "gather",
        priority: 10,
        targetPosition: nearestWater,
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

    // Fallback: rest in place
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
