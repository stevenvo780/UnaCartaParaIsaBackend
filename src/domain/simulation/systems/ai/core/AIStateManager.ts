import type { GameState } from "../../../../types/game-types";
import type {
  AIState,
  AgentPersonality,
} from "../../../../types/simulation/ai";
import type { AgentTraits } from "../../../../types/simulation/agents";
import { getFrameTime } from "../../../../../shared/FrameTime";
import { logger } from "../../../../../infrastructure/utils/logger";
import {
  SocialPreference,
  WorkEthic,
  AgentPriority,
} from "../../../../../shared/constants/AIEnums";
import {
  ExplorationType,
  LifeStage,
} from "../../../../../shared/constants/AgentEnums";
import type { AgentRegistry } from "../../../core/AgentRegistry";

/**
 * Manages AI state creation, retrieval, and cleanup for agents.
 * Handles personality derivation from agent traits and memory management.
 */
export class AIStateManager {
  private readonly aiStates: Map<string, AIState>;
  private readonly gameState: GameState;
  private readonly playerControlledAgents: Set<string>;
  private readonly agentPriorities: Map<string, AgentPriority>;
  private readonly agentStrategies: Map<
    string,
    "peaceful" | "tit_for_tat" | "bully"
  >;
  private readonly agentRegistry?: AgentRegistry;

  private _activeAgentIdsCache: string[] | null = null;

  constructor(
    gameState: GameState,
    aiStates: Map<string, AIState>,
    playerControlledAgents: Set<string>,
    agentPriorities: Map<string, AgentPriority>,
    agentStrategies: Map<string, "peaceful" | "tit_for_tat" | "bully">,
    agentRegistry?: AgentRegistry,
  ) {
    this.gameState = gameState;
    this.aiStates = aiStates;
    this.playerControlledAgents = playerControlledAgents;
    this.agentPriorities = agentPriorities;
    this.agentStrategies = agentStrategies;
    this.agentRegistry = agentRegistry;
  }

  /** Gets or sets the active agent IDs cache */
  public get activeAgentIdsCache(): string[] | null {
    return this._activeAgentIdsCache;
  }

  public set activeAgentIdsCache(value: string[] | null) {
    this._activeAgentIdsCache = value;
  }

  /**
   * Initializes AI states for all agents in the game state.
   */
  public initialize(): void {
    logger.info("🧠 Initializing AIStateManager...");
    const agents = this.gameState.agents || [];
    let count = 0;
    for (const agent of agents) {
      if (!this.aiStates.has(agent.id)) {
        const aiState = this.createAIState(agent.id);
        this.aiStates.set(agent.id, aiState);
        count++;
      }
    }
    logger.info(
      `🧠 AIStateManager initialized with ${count} new agent states (total: ${this.aiStates.size})`,
    );
  }

  /**
   * Gets AI state for an agent, creating it lazily if needed.
   */
  public getAIState(agentId: string): AIState | undefined {
    let state = this.aiStates.get(agentId);
    if (!state) {
      const agent = this.agentRegistry?.getProfile(agentId);
      if (agent) {
        state = this.createAIState(agentId);
        this.aiStates.set(agentId, state);
      }
    }
    return state;
  }

  /**
   * Gets all AI states.
   */
  public getAllAIStates(): AIState[] {
    return Array.from(this.aiStates.values());
  }

  /**
   * Creates a new AI state for an agent.
   */
  public createAIState(agentId: string): AIState {
    const agent = this.agentRegistry?.getProfile(agentId);
    let personality: AgentPersonality;

    if (agent && agent.traits) {
      personality = this.derivePersonalityFromTraits(
        agent.traits,
        agent.lifeStage || "adult",
      );
    } else {
      personality = this.generatePersonalityFallback();
    }

    return {
      entityId: agentId,
      personality,
      memory: {
        lastSeenThreats: [],
        visitedZones: new Set(),
        recentInteractions: [],
        knownResourceLocations: new Map(),
        homeZoneId: undefined,
        successfulActivities: new Map(),
        failedAttempts: new Map(),
        failedTargets: new Map(),
        lastExplorationTime: 0,
        lastMemoryCleanup: getFrameTime(),
      },
      currentGoal: null,
      goalQueue: [],
      lastDecisionTime: getFrameTime(),
      currentAction: null,
      offDuty: false,
    };
  }

  /**
   * Removes AI state for an entity.
   */
  public removeEntityAI(entityId: string): void {
    this.aiStates.delete(entityId);
    this.playerControlledAgents.delete(entityId);
    this.agentPriorities.delete(entityId);
    this.agentStrategies.delete(entityId);
    this.activeAgentIdsCache = null;
  }

  /**
   * Clears all AI states.
   */
  public clearAll(): void {
    this.aiStates.clear();
    this.agentPriorities.clear();
    this.agentStrategies.clear();
    this.playerControlledAgents.clear();
    this.activeAgentIdsCache = null;
  }

  /**
   * Sets whether an agent is off-duty.
   */
  public setAgentOffDuty(
    agentId: string,
    offDuty: boolean,
    stopMovementFn?: (agentId: string) => void,
  ): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.offDuty = offDuty;
      if (offDuty) {
        aiState.currentGoal = null;
        aiState.currentAction = null;
        if (stopMovementFn) {
          stopMovementFn(agentId);
        }
      }
    }
  }

  /**
   * Forces goal reevaluation for an agent.
   */
  public forceGoalReevaluation(agentId: string): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.currentGoal = null;
      aiState.currentAction = null;
    }
  }

  /**
   * Sets agent priority mode.
   */
  public setAgentPriority(agentId: string, priority: AgentPriority): void {
    this.agentPriorities.set(agentId, priority);
  }

  /**
   * Gets agent priority mode.
   */
  public getAgentPriority(agentId: string): AgentPriority {
    return this.agentPriorities.get(agentId) || AgentPriority.NORMAL;
  }

  /**
   * Sets agent strategy.
   */
  public setAgentStrategy(
    agentId: string,
    strategy: "peaceful" | "tit_for_tat" | "bully",
  ): void {
    this.agentStrategies.set(agentId, strategy);
  }

  /**
   * Gets agent strategy.
   */
  public getAgentStrategy(
    agentId: string,
  ): "peaceful" | "tit_for_tat" | "bully" {
    return this.agentStrategies.get(agentId) || "peaceful";
  }

  /**
   * Checks if an agent is player controlled.
   */
  public isPlayerControlled(agentId: string): boolean {
    return this.playerControlledAgents.has(agentId);
  }

  /**
   * Sets player control for an agent.
   */
  public setPlayerControlled(agentId: string, controlled: boolean): void {
    if (controlled) {
      this.playerControlledAgents.add(agentId);
    } else {
      this.playerControlledAgents.delete(agentId);
    }
  }

  /**
   * Cleans up old memory entries for all agents.
   * Uses time-based cleanup for threats and interactions, and size-based limits
   * with priority sorting for activities and attempts.
   */
  public cleanupAgentMemory(now: number): void {
    const THREAT_MAX_AGE_MS = 30000;
    const INTERACTION_MAX_AGE_MS = 60000;

    for (const [_agentId, aiState] of this.aiStates) {
      if (aiState.memory.visitedZones.size > 100) {
        const zones = [...aiState.memory.visitedZones];
        aiState.memory.visitedZones = new Set(zones.slice(-100));
      }

      if (
        aiState.memory.successfulActivities &&
        aiState.memory.successfulActivities.size > 50
      ) {
        const sorted = [...aiState.memory.successfulActivities.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50) as Array<[string, number]>;
        aiState.memory.successfulActivities = new Map(sorted);
      }

      if (aiState.memory.lastSeenThreats?.length > 0) {
        aiState.memory.lastSeenThreats = aiState.memory.lastSeenThreats.filter(
          (threat) => now - threat.timestamp < THREAT_MAX_AGE_MS,
        );
      }

      if (aiState.memory.recentInteractions?.length > 20) {
        aiState.memory.recentInteractions = aiState.memory.recentInteractions
          .filter((i) => now - i.timestamp < INTERACTION_MAX_AGE_MS)
          .slice(-20);
      }

      if (
        aiState.memory.knownResourceLocations &&
        aiState.memory.knownResourceLocations.size > 100
      ) {
        const locations = [...aiState.memory.knownResourceLocations.entries()];
        aiState.memory.knownResourceLocations = new Map(locations.slice(-100));
      }

      if (
        aiState.memory.failedAttempts &&
        aiState.memory.failedAttempts.size > 50
      ) {
        const sorted = [...aiState.memory.failedAttempts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50) as Array<[string, number]>;
        aiState.memory.failedAttempts = new Map(sorted);
      }

      aiState.memory.lastMemoryCleanup = now;
    }
  }

  /**
   * Derives personality from agent traits.
   */
  private derivePersonalityFromTraits(
    traits: AgentTraits,
    lifeStage: LifeStage,
  ): AgentPersonality {
    const isChild = lifeStage === LifeStage.CHILD;

    const openness = (traits.curiosity + (traits.intelligence || 0.5)) / 2;
    const conscientiousness =
      (traits.diligence + (traits.cooperation || 0.5)) / 2;
    const extraversion =
      (traits.charisma || 0.5) + (traits.aggression || 0.5) / 2;
    const agreeableness =
      (traits.cooperation || 0.5) - (traits.aggression || 0.5) / 2;
    const neuroticism = 1 - (traits.bravery || 0.5);

    return {
      cooperation: traits.cooperation,
      diligence: traits.diligence,
      curiosity: traits.curiosity,
      openness,
      conscientiousness,
      extraversion,
      agreeableness,
      neuroticism,
      riskTolerance:
        (traits.bravery || 0.5) * 0.7 + (traits.curiosity || 0.5) * 0.3,
      socialPreference: isChild
        ? SocialPreference.EXTROVERTED
        : (traits.charisma || 0.5) * 0.6 + (traits.cooperation || 0.5) * 0.4 >
            0.6
          ? SocialPreference.EXTROVERTED
          : (traits.charisma || 0.5) * 0.6 + (traits.cooperation || 0.5) * 0.4 <
              0.4
            ? SocialPreference.INTROVERTED
            : SocialPreference.BALANCED,
      workEthic: isChild
        ? WorkEthic.LAZY
        : (traits.diligence || 0.5) * 0.8 + (traits.stamina || 0.5) * 0.2 > 0.7
          ? WorkEthic.WORKAHOLIC
          : (traits.diligence || 0.5) * 0.8 + (traits.stamina || 0.5) * 0.2 <
              0.3
            ? WorkEthic.LAZY
            : WorkEthic.BALANCED,
      explorationType:
        (traits.curiosity || 0.5) > 0.7
          ? ExplorationType.ADVENTUROUS
          : ExplorationType.CAUTIOUS,
    };
  }

  /**
   * Generates fallback personality when traits are not available.
   */
  private generatePersonalityFallback(): AgentPersonality {
    return {
      cooperation: 0.5,
      diligence: 0.5,
      curiosity: 0.5,
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
      riskTolerance: 0.5,
      socialPreference: SocialPreference.BALANCED,
      workEthic: WorkEthic.BALANCED,
      explorationType: ExplorationType.BALANCED,
    };
  }

  /**
   * Invalidates the active agents cache.
   */
  public invalidateActiveAgentsCache(): void {
    this.activeAgentIdsCache = null;
  }
}
