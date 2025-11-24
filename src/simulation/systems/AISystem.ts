import { EventEmitter } from 'node:events';
import type { GameState } from '../../types/game-types.js';
import type { AgentProfile } from '../types/agents.js';
import type {
  AIState,
  AIGoal,
  AgentAction,
  AISystemConfig,
  AgentPersonality,
  AgentMemory,
} from '../types/ai.js';
import { simulationEvents, GameEventNames } from '../events.js';
import { evaluateCriticalNeeds } from './ai/NeedsEvaluator.js';
import {
  evaluateWorkOpportunities,
  evaluateExplorationGoals,
} from './ai/OpportunitiesEvaluator.js';
import type { NeedsSystem } from './NeedsSystem.js';
import type { RoleSystem } from './RoleSystem.js';
import type { WorldResourceSystem } from './WorldResourceSystem.js';

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

  // System dependencies
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
    }
  ) {
    super();
    this.gameState = gameState;
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
    this.lastUpdate = Date.now();

    // Set system dependencies
    if (systems) {
      this.needsSystem = systems.needsSystem;
      this.roleSystem = systems.roleSystem;
      this.worldResourceSystem = systems.worldResourceSystem;
    }

    console.log('🤖 AISystem (Backend) initialized');
  }

  public update(deltaMs: number): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdate;

    if (timeSinceLastUpdate < this.config.decisionIntervalMs) {
      return;
    }

    this.lastUpdate = now;

    // Get all adult agents from game state
    const agents = this.getAdultAgents();

    // Process agents in batches to distribute load
    const batchStart = this.currentBatchIndex;
    const batchEnd = Math.min(
      batchStart + this.config.batchSize,
      agents.length
    );

    for (let i = batchStart; i < batchEnd; i++) {
      const agent = agents[i];
      this.processAgentDecision(agent, now);
    }

    // Move to next batch
    this.currentBatchIndex = batchEnd;
    if (this.currentBatchIndex >= agents.length) {
      this.currentBatchIndex = 0;
    }
  }

  private getAdultAgents(): AgentProfile[] {
    const entities = this.gameState.agents || [];
    return entities.filter(
      (e: any) => e.lifeStage === 'adult' && !e.immortal
    ) as AgentProfile[];
  }

  private processAgentDecision(agent: AgentProfile, now: number): void {
    // Get or create AI state for this agent
    let aiState = this.aiStates.get(agent.id);

    if (!aiState) {
      aiState = this.createAIState(agent);
      this.aiStates.set(agent.id, aiState);
    }

    // Skip if agent is off duty
    if (aiState.offDuty) {
      return;
    }

    // Check if current goal is still valid
    if (aiState.currentGoal) {
      const goalAge = now - aiState.currentGoal.createdAt;
      if (goalAge > this.config.goalTimeoutMs) {
        // Goal expired, clear it
        aiState.currentGoal = null;
        this.emit('goalExpired', { agentId: agent.id });
      } else {
        // Goal still valid, don't make new decision yet
        return;
      }
    }

    // Generate new goals
    const goals = this.planGoals(aiState, agent);

    if (goals.length === 0) {
      return;
    }

    // Select highest priority goal
    const selectedGoal = goals[0];
    aiState.currentGoal = selectedGoal;
    aiState.lastDecisionTime = now;

    // Emit goal changed event
    simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
      agentId: agent.id,
      goal: selectedGoal,
    });

    // Convert goal to action command
    const action = this.goalToAction(selectedGoal, agent.id, now);

    if (action) {
      // Emit action command for frontend
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
        action,
      });
    }
  }

  private createAIState(agent: AgentProfile): AIState {
    const personality: AgentPersonality = {
      cooperation: agent.traits.cooperation,
      diligence: agent.traits.diligence,
      curiosity: agent.traits.curiosity,
    };

    const memory: AgentMemory = {
      lastSeenThreats: [],
      visitedZones: new Set(),
      recentInteractions: [],
      knownResourceLocations: new Map(),
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

  private planGoals(aiState: AIState, agent: AgentProfile): AIGoal[] {
    const allGoals: AIGoal[] = [];

    // 1. Evaluate critical needs (highest priority)
    if (this.needsSystem) {
      const needsGoals = evaluateCriticalNeeds(
        {
          getEntityNeeds: (id) => this.needsSystem?.getEntityNeeds(id),
          findNearestResource: this.worldResourceSystem
            ? (entityId, resourceType) =>
              this.findNearestResourceForEntity(entityId, resourceType)
            : undefined,
        },
        aiState
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
            ? (entityId, resourceType) =>
              this.findNearestResourceForEntity(entityId, resourceType)
            : undefined,
        },
        aiState
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
    resourceType: string
  ): { id: string; x: number; y: number } | null {
    if (!this.worldResourceSystem) return null;

    // Get all resources of this type
    const resources = this.worldResourceSystem.getResourcesByType(resourceType);
    if (resources.length === 0) return null;

    // For now, return first available (TODO: implement spatial distance)
    const resource = resources[0];
    return {
      id: resource.id,
      x: resource.position.x,
      y: resource.position.y,
    };
  }

  private getPreferredResourceForRole(roleType: string): string | null {
    const roleResourceMap: Record<string, string> = {
      logger: 'tree',
      quarryman: 'rock',
      farmer: 'wheat',
      gatherer: 'berry_bush',
    };
    return roleResourceMap[roleType] || null;
  }

  private goalToAction(
    goal: AIGoal,
    agentId: string,
    timestamp: number
  ): AgentAction | null {
    // TODO: Implement goal-to-action conversion
    // For now, create basic action

    switch (goal.type) {
      case 'explore':
        return {
          actionType: 'move',
          agentId,
          targetPosition: goal.targetPosition,
          timestamp,
          data: { goalType: goal.type },
        };

      case 'satisfy_need':
        // Will implement need-specific actions
        return null;

      case 'work':
        return {
          actionType: 'work',
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
