import { EventEmitter } from "node:events";
import type { GameState } from "../../types/game-types";
import type { AgentProfile } from "../../types/simulation/agents";
import type {
  AIState,
  AIGoal,
  AgentAction,
  AISystemConfig,
  AgentPersonality,
  AgentMemory,
} from "../../types/simulation/ai";
import { simulationEvents, GameEventNames } from "../core/events";
import { evaluateCriticalNeeds } from "./ai/NeedsEvaluator";
import {
  evaluateWorkOpportunities,
  evaluateExplorationGoals,
} from "./ai/OpportunitiesEvaluator";
import type { NeedsSystem } from "./NeedsSystem";
import type { RoleSystem } from "./RoleSystem";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { WorldResourceType } from "../../types/simulation/worldResources";

const DEFAULT_AI_CONFIG: AISystemConfig = {
  decisionIntervalMs: 500,
  goalTimeoutMs: 15000,
  minPriorityThreshold: 0.3,
  batchSize: 5,
};

export class AISystem extends EventEmitter {
  private gameState: GameState;
  private config: AISystemConfig;
  private aiStates = new Map<string, AIState>();
  private lastUpdate = 0;
  private currentBatchIndex = 0;

  private needsSystem?: NeedsSystem;
  private roleSystem?: RoleSystem;
  private worldResourceSystem?: WorldResourceSystem;

  constructor(
    gameState: GameState,
    config?: Partial<AISystemConfig>,
    systems?: {
      needsSystem?: NeedsSystem;
      roleSystem?: RoleSystem;
      worldResourceSystem?: WorldResourceSystem;
    },
  ) {
    super();
    this.gameState = gameState;
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
    this.lastUpdate = Date.now();

    if (systems) {
      this.needsSystem = systems.needsSystem;
      this.roleSystem = systems.roleSystem;
      this.worldResourceSystem = systems.worldResourceSystem;
    }

    console.log("🤖 AISystem (Backend) initialized");
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdate;

    if (timeSinceLastUpdate < this.config.decisionIntervalMs) {
      return;
    }

    this.lastUpdate = now;

    const agents = this.getAdultAgents();
    const batchStart = this.currentBatchIndex;
    const batchEnd = Math.min(
      batchStart + this.config.batchSize,
      agents.length,
    );

    for (let i = batchStart; i < batchEnd; i++) {
      const agent = agents[i];
      this.processAgentDecision(agent, now);
    }

    this.currentBatchIndex = batchEnd;
    if (this.currentBatchIndex >= agents.length) {
      this.currentBatchIndex = 0;
    }
  }

  private getAdultAgents(): AgentProfile[] {
    return (this.gameState.agents || []).filter(
      (e) => e.lifeStage === "adult" && !e.immortal,
    );
  }

  private processAgentDecision(agent: AgentProfile, now: number): void {
    let aiState = this.aiStates.get(agent.id);

    if (!aiState) {
      aiState = this.createAIState(agent);
      this.aiStates.set(agent.id, aiState);
    }

    if (aiState.offDuty) {
      return;
    }

    if (aiState.currentGoal) {
      const goalAge = now - aiState.currentGoal.createdAt;
      if (goalAge > this.config.goalTimeoutMs) {
        aiState.currentGoal = null;
        this.emit("goalExpired", { agentId: agent.id });
      } else {
        return;
      }
    }

    const goals = this.planGoals(aiState, agent);

    if (goals.length === 0) {
      return;
    }

    const selectedGoal = goals[0];
    aiState.currentGoal = selectedGoal;
    aiState.lastDecisionTime = now;

    simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
      agentId: agent.id,
      goal: selectedGoal,
    });

    const action = this.goalToAction(selectedGoal, agent.id, now);

    if (action) {
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
        action,
      });
    }
  }

  /**
   * Derive full personality from agent traits, considering life stage
   */
  private derivePersonalityFromTraits(
    traits: {
      cooperation: number;
      aggression: number;
      diligence: number;
      curiosity: number;
    },
    lifeStage: "child" | "adult" | "elder",
  ): AgentPersonality {
    // Exploration type based on curiosity
    const explorationType =
      traits.curiosity > 0.7
        ? "adventurous"
        : traits.curiosity < 0.3
          ? "cautious"
          : "balanced";

    // Social preference based on cooperation
    const socialPreference =
      traits.cooperation > 0.7
        ? "extroverted"
        : traits.cooperation < 0.3
          ? "introverted"
          : "balanced";

    // Work ethic based on diligence
    const workEthic =
      traits.diligence > 0.7
        ? "workaholic"
        : traits.diligence < 0.3
          ? "lazy"
          : "balanced";

    // Risk tolerance: combines aggression and curiosity, modified by age
    const ageModifier =
      lifeStage === "elder" ? -0.2 : lifeStage === "child" ? -0.1 : 0;
    const riskTolerance = Math.max(
      0,
      Math.min(
        1,
        traits.aggression * 0.6 + traits.curiosity * 0.4 + ageModifier,
      ),
    );

    return {
      cooperation: traits.cooperation,
      diligence: traits.diligence,
      curiosity: traits.curiosity,
      aggression: traits.aggression,
      explorationType,
      socialPreference,
      workEthic,
      riskTolerance,
      neuroticism: Math.max(
        0,
        1 - (traits.aggression * 0.5 + traits.curiosity * 0.5),
      ),
      extraversion: traits.cooperation,
      openness: traits.curiosity,
      conscientiousness: traits.diligence,
      agreeableness: traits.cooperation,
    };
  }

  /**
   * Generate random personality when traits are not available
   */
  private generatePersonalityFallback(): AgentPersonality {
    console.warn("⚠️ Generating personality without traits (fallback)");

    const explorationTypes = ["cautious", "balanced", "adventurous"] as const;
    const socialPreferences = [
      "introverted",
      "balanced",
      "extroverted",
    ] as const;
    const workEthics = ["lazy", "balanced", "workaholic"] as const;

    const cooperation = Math.random();
    const diligence = Math.random();
    const curiosity = Math.random();
    const aggression = Math.random();

    return {
      cooperation,
      diligence,
      curiosity,
      aggression,
      explorationType:
        explorationTypes[Math.floor(Math.random() * explorationTypes.length)],
      socialPreference:
        socialPreferences[
        Math.floor(Math.random() * socialPreferences.length)
        ],
      workEthic: workEthics[Math.floor(Math.random() * workEthics.length)],
      riskTolerance: 0.3 + Math.random() * 0.4,
      neuroticism: Math.random(),
      extraversion: Math.random(),
      openness: Math.random(),
      conscientiousness: Math.random(),
      agreeableness: Math.random(),
    };
  }

  private createAIState(agent: AgentProfile): AIState {
    // Derive full personality from traits
    const personality = agent.traits
      ? this.derivePersonalityFromTraits(agent.traits, agent.lifeStage)
      : this.generatePersonalityFallback();

    const memory: AgentMemory = {
      lastSeenThreats: [],
      visitedZones: new Set(),
      recentInteractions: [],
      knownResourceLocations: new Map(),
      successfulActivities: new Map(),
      failedAttempts: new Map(),
      lastMemoryCleanup: Date.now(),
    };

    return {
      entityId: agent.id,
      currentGoal: null,
      goalQueue: [],
      lastDecisionTime: Date.now(),
      personality,
      memory,
      offDuty: false,
    };
  }

  private planGoals(aiState: AIState, _agent: AgentProfile): AIGoal[] {
    const allGoals: AIGoal[] = [];

    if (this.needsSystem) {
      const needsGoals = evaluateCriticalNeeds(
        {
          getEntityNeeds: (id) => this.needsSystem?.getEntityNeeds(id),
          findNearestResource: this.worldResourceSystem
            ? (entityId: string, resourceType: string) =>
              this.findNearestResourceForEntity(entityId, resourceType)
            : undefined,
        },
        aiState,
      );
      allGoals.push(...needsGoals);
    }

    // 2. Evaluate work opportunities (if not critical needs)
    if (allGoals.length === 0 && this.roleSystem) {
      const workGoals = evaluateWorkOpportunities(
        {
          getAgentRole: (id) => this.roleSystem?.getAgentRole(id),
          getPreferredResourceForRole: (roleType) =>
            this.getPreferredResourceForRole(roleType),
          findNearestResource: this.worldResourceSystem
            ? (entityId: string, resourceType: string) =>
              this.findNearestResourceForEntity(entityId, resourceType)
            : undefined,
        },
        aiState,
      );
      allGoals.push(...workGoals);
    }

    // 3. Default exploration (lowest priority)
    if (allGoals.length === 0) {
      const explorationGoals = evaluateExplorationGoals(aiState);
      allGoals.push(...explorationGoals);
    }

    // Sort by priority
    return allGoals.sort((a, b) => b.priority - a.priority);
  }

  private findNearestResourceForEntity(
    entityId: string,
    resourceType: string,
  ): { id: string; x: number; y: number } | null {
    if (!this.worldResourceSystem) return null;

    // Get all resources of this type
    const resources = this.worldResourceSystem.getResourcesByType(
      resourceType as WorldResourceType,
    );
    if (resources.length === 0) return null;

    // Get entity position
    const entity = this.gameState.entities?.find((e) => e.id === entityId);
    if (!entity) {
      // Fallback to first available if entity not found
      const resource = resources[0];
      return {
        id: resource.id,
        x: resource.position.x,
        y: resource.position.y,
      };
    }

    const entityPos = entity.position || { x: entity.x, y: entity.y };

    // Calculate distance to each resource and find nearest
    let nearestResource = resources[0];
    let minDistance = Infinity;

    for (const resource of resources) {
      const dx = resource.position.x - entityPos.x;
      const dy = resource.position.y - entityPos.y;
      const distance = Math.hypot(dx, dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearestResource = resource;
      }
    }

    return {
      id: nearestResource.id,
      x: nearestResource.position.x,
      y: nearestResource.position.y,
    };
  }

  private getPreferredResourceForRole(roleType: string): string | null {
    const roleResourceMap: Record<string, string> = {
      logger: "tree",
      quarryman: "rock",
      farmer: "wheat",
      gatherer: "berry_bush",
    };
    return roleResourceMap[roleType] || null;
  }

  private goalToAction(
    goal: AIGoal,
    agentId: string,
    timestamp: number,
  ): AgentAction | null {
    // Convert AI goals to concrete agent actions

    switch (goal.type) {
      case "explore":
        return {
          actionType: "move",
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
          data: { goalType: goal.type },
        };

      case "satisfy_need":
        if (goal.data?.action === "rest") {
          return {
            actionType: "sleep",
            agentId,
            timestamp,
            data: { need: "energy" },
          };
        }

        if (goal.targetId && goal.targetPosition) {
          let actionType: "eat" | "drink" | "harvest" = "harvest";
          if (goal.data?.need === "hunger") actionType = "eat";
          if (goal.data?.need === "thirst") actionType = "drink";

          return {
            actionType,
            agentId,
            targetId: goal.targetId,
            targetPosition: goal.targetPosition,
            timestamp,
            data: {
              resourceType: goal.data?.resourceType,
              need: goal.data?.need,
            },
          };
        }
        return null;

      case "work":
        return {
          actionType: "work",
          agentId,
          targetZoneId: goal.targetZoneId,
          timestamp,
        };

      default:
        return null;
    }
  }

  public getAIState(agentId: string): AIState | undefined {
    return this.aiStates.get(agentId);
  }

  public getAllAIStates(): AIState[] {
    return Array.from(this.aiStates.values());
  }

  public setAgentOffDuty(agentId: string, offDuty: boolean): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.offDuty = offDuty;
      if (offDuty) {
        aiState.currentGoal = null;
      }
    }
  }
}
