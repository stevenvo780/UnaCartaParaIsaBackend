import type { GameState } from "../../../../types/game-types";
import type { AIGoal } from "../../../../types/simulation/ai";
import { GoalType } from "../../../../../shared/constants/AIEnums";
import { NeedType } from "../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../shared/constants/ResourceEnums";
import { WorldResourceType } from "../../../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";
import { toInventoryResource } from "../../../../types/simulation/resourceMapping";
import type { AgentRegistry } from "../../../core/AgentRegistry";

export interface AIUrgentGoalsDeps {
  gameState: GameState;
  agentRegistry: AgentRegistry;
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
    const position = this.deps.agentRegistry.getPosition(agentId) ?? null;
    if (!position) return null;

    const foodResourceTypes = [
      WorldResourceType.BERRY_BUSH,
      WorldResourceType.MUSHROOM_PATCH,
      WorldResourceType.WHEAT_CROP,
    ];
    for (const resourceType of foodResourceTypes) {
      const nearestFood = this.deps.findNearestResourceForEntity(
        agentId,
        resourceType,
      );
      if (nearestFood) {
        return {
          id: `urgent-gather-${agentId}-${now}`,
          type: GoalType.GATHER,
          priority: 10,
          targetId: nearestFood.id,
          targetPosition: { x: nearestFood.x, y: nearestFood.y },
          createdAt: now,
          data: {
            resourceType: toInventoryResource(resourceType) || undefined,
            need: NeedType.HUNGER,
          },
        };
      }
    }

    return null;
  }

  /**
   * Creates urgent water goal when thirst is critical.
   */
  public createUrgentWaterGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.agentRegistry.getPosition(agentId) ?? null;
    if (!position) return null;

    const nearestWater = this.deps.findNearestResourceForEntity(
      agentId,
      WorldResourceType.WATER_SOURCE,
    );
    if (nearestWater) {
      return {
        id: `urgent-gather-water-${agentId}-${now}`,
        type: GoalType.GATHER,
        priority: 10,
        targetId: nearestWater.id,
        targetPosition: { x: nearestWater.x, y: nearestWater.y },
        createdAt: now,
        data: { resourceType: ResourceType.WATER, need: NeedType.THIRST },
      };
    }

    return null;
  }

  /**
   * Creates urgent rest goal when energy is critical.
   */
  public createUrgentRestGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.agentRegistry.getPosition(agentId) ?? null;
    if (!position) return null;

    const restZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === ZoneType.REST ||
        z.type === ZoneType.BEDROOM ||
        z.type === ZoneType.SHELTER,
    );

    if (restZone?.bounds) {
      return {
        id: `urgent-rest-${agentId}-${now}`,
        type: GoalType.SATISFY_ENERGY,
        priority: 10,
        targetZoneId: restZone.id,
        createdAt: now,
        data: { need: NeedType.ENERGY },
      };
    }

    return {
      id: `urgent-rest-idle-${agentId}-${now}`,
      type: GoalType.SATISFY_ENERGY,
      priority: 9,
      createdAt: now,
      data: { need: NeedType.ENERGY },
    };
  }

  /**
   * Creates urgent social goal when social need is critical.
   */
  public createUrgentSocialGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.agentRegistry.getPosition(agentId) ?? null;
    if (!position) return null;

    const socialZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === ZoneType.SOCIAL ||
        z.type === ZoneType.GATHERING ||
        z.type === ZoneType.MARKET ||
        z.type === ZoneType.TAVERN,
    );

    if (socialZone?.bounds) {
      return {
        id: `urgent-social-${agentId}-${now}`,
        type: GoalType.SATISFY_SOCIAL,
        priority: 9,
        targetZoneId: socialZone.id,
        createdAt: now,
        data: { need: NeedType.SOCIAL },
      };
    }

    return null;
  }

  /**
   * Creates urgent fun goal when fun need is critical.
   */
  public createUrgentFunGoal(agentId: string, now: number): AIGoal | null {
    const position = this.deps.agentRegistry.getPosition(agentId) ?? null;
    if (!position) return null;

    const funZone = this.deps.gameState.zones?.find(
      (z) =>
        z.type === ZoneType.ENTERTAINMENT ||
        z.type === ZoneType.TAVERN ||
        z.type === ZoneType.MARKET ||
        z.type === ZoneType.GATHERING,
    );

    if (funZone?.bounds) {
      return {
        id: `urgent-fun-${agentId}-${now}`,
        type: GoalType.SATISFY_FUN,
        priority: 8,
        targetZoneId: funZone.id,
        createdAt: now,
        data: { need: NeedType.FUN },
      };
    }

    return null;
  }
}
