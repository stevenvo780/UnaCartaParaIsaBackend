import { EventEmitter } from "events";
import { GameState } from "../../core/GameState";
import {
  AIGoal,
  AIState,
  AgentAction,
  AgentMemory,
  AgentPersonality,
  GoalType,
  AgentProfile,
  AgentTraits,
  LifeStage,
} from "../../types/simulation/ai";
import { NeedsEvaluator } from "../evaluators/NeedsEvaluator";
import { OpportunitiesEvaluator } from "../evaluators/OpportunitiesEvaluator";
import { GameEventNames } from "../../core/events";
import { simulationEvents } from "../../core/events";
import type { NeedsSystem } from "./NeedsSystem";
import type { RoleSystem } from "./RoleSystem";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { CraftingSystem } from "./CraftingSystem";
import type { HouseholdSystem } from "./HouseholdSystem";

interface AISystemConfig {
  updateIntervalMs: number;
  enablePersonality: boolean;
  enableMemory: boolean;
  maxMemoryItems: number;
}

export class AISystem extends EventEmitter {
  private gameState: GameState;
  private config: AISystemConfig;
  private aiStates: Map<string, AIState>;
  private needsEvaluator: NeedsEvaluator;
  private opportunitiesEvaluator: OpportunitiesEvaluator;
  private lastUpdate: number = 0;

  // Dependencies
  private needsSystem?: NeedsSystem;
  private roleSystem?: RoleSystem;
  private worldResourceSystem?: WorldResourceSystem;
  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;
  private craftingSystem?: CraftingSystem;
  private householdSystem?: HouseholdSystem;

  // Phase 3: Memory Cleanup Tracking
  private _lastMemoryCleanupTime = 0;
  private readonly MEMORY_CLEANUP_INTERVAL = 300000; // 5 minutes

  // Phase 4: Advanced Features
  private agentStrategies = new Map<string, "peaceful" | "tit_for_tat" | "bully">();
  private playerControlledAgents = new Set<string>();
  private agentPriorities = new Map<string, "survival" | "normal" | "social">();

  // Statistics
  private _decisionTimeTotalMs = 0;
  private _decisionCount = 0;
  private _goalsCompleted = 0;
  private _goalsFailed = 0;

  constructor(
    gameState: GameState,
    config?: Partial<AISystemConfig>,
    systems?: {
      needsSystem?: NeedsSystem;
      roleSystem?: RoleSystem;
      worldResourceSystem?: WorldResourceSystem;
      inventorySystem?: InventorySystem;
      socialSystem?: SocialSystem;
      craftingSystem?: CraftingSystem;
      householdSystem?: HouseholdSystem;
    },
  ) {
    super();
    this.gameState = gameState;
    this.config = {
      updateIntervalMs: 1000,
      enablePersonality: true,
      enableMemory: true,
      maxMemoryItems: 50,
      ...config,
    };

    this.aiStates = new Map();
    this.needsEvaluator = new NeedsEvaluator();
    this.opportunitiesEvaluator = new OpportunitiesEvaluator();

    if (systems) {
      this.needsSystem = systems.needsSystem;
      this.roleSystem = systems.roleSystem;
      this.worldResourceSystem = systems.worldResourceSystem;
      this.inventorySystem = systems.inventorySystem;
      this.socialSystem = systems.socialSystem;
      this.craftingSystem = systems.craftingSystem;
      this.householdSystem = systems.householdSystem;
    }
  }

  public setDependencies(systems: {
    needsSystem?: NeedsSystem;
    roleSystem?: RoleSystem;
    worldResourceSystem?: WorldResourceSystem;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
    craftingSystem?: CraftingSystem;
    householdSystem?: HouseholdSystem;
  }): void {
    if (systems.needsSystem) this.needsSystem = systems.needsSystem;
    if (systems.roleSystem) this.roleSystem = systems.roleSystem;
    if (systems.worldResourceSystem) this.worldResourceSystem = systems.worldResourceSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
    if (systems.craftingSystem) this.craftingSystem = systems.craftingSystem;
    if (systems.householdSystem) this.householdSystem = systems.householdSystem;
  }

  public update(deltaTimeMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }

    // Phase 3: Periodic Memory Cleanup
    if (now - this._lastMemoryCleanupTime >= this.MEMORY_CLEANUP_INTERVAL) {
      this.cleanupAgentMemory(now);
      this._lastMemoryCleanupTime = now;
    }

    this.lastUpdate = now;
    const agents = this.gameState.agents || [];

    // Process agents in batches to avoid lag spikes
    const BATCH_SIZE = 10;
    let processed = 0;

    for (const agent of agents) {
      // Skip player controlled agents
      if (this.playerControlledAgents.has(agent.id)) continue;

      if (processed >= BATCH_SIZE) break; // Simple time slicing for now

      let aiState = this.aiStates.get(agent.id);
      if (!aiState) {
        aiState = this.createAIState(agent.id);
        this.aiStates.set(agent.id, aiState);
      }

      if (aiState.offDuty) continue;

      this.processAgent(agent.id, aiState, now);
      processed++;
    }
  }

  private processAgent(agentId: string, aiState: AIState, now: number): void {
    // 1. Check if current goal is completed or invalid
    if (aiState.currentGoal) {
      if (this.isGoalCompleted(aiState.currentGoal, agentId)) {
        this.completeGoal(aiState, agentId);
      } else if (this.isGoalInvalid(aiState.currentGoal, agentId)) {
        this.failGoal(aiState, agentId);
      } else {
        // Continue current goal
        return;
      }
    }

    // 2. Formulate new goal if needed
    if (!aiState.currentGoal) {
      const startTime = performance.now();
      const newGoal = this.makeDecision(agentId, aiState);
      const endTime = performance.now();

      this._decisionTimeTotalMs += (endTime - startTime);
      this._decisionCount++;

      if (newGoal) {
        aiState.currentGoal = newGoal;
        simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
          agentId,
          newGoal,
          timestamp: now,
        });
      }
    }

    // 3. Execute action for current goal
    if (aiState.currentGoal) {
      const action = this.planAction(agentId, aiState.currentGoal);
      if (action) {
        aiState.currentAction = action;
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
          agentId,
          action,
          timestamp: now,
        });
      }
    }
  }

  private makeDecision(agentId: string, aiState: AIState): AIGoal | null {
    // 1. Check critical needs first (Survival Priority)
    const priority = this.agentPriorities.get(agentId) || "normal";

    if (this.needsSystem) {
      const needs = this.needsSystem.getNeeds(agentId);
      if (needs) {
        const criticalGoal = this.needsEvaluator.evaluateCriticalNeeds(
          agentId,
          needs,
          aiState.personality,
        );
        if (criticalGoal) return criticalGoal;
      }
    }

    // If in survival mode, only focus on needs
    if (priority === "survival") return null;

    // 2. Evaluate opportunities
    // Pass available systems to evaluator
    const opportunities = this.opportunitiesEvaluator.evaluateOpportunities(
      agentId,
      this.gameState,
      aiState.personality,
      {
        roleSystem: this.roleSystem,
        worldResourceSystem: this.worldResourceSystem,
        socialSystem: this.socialSystem,
      }
    );

    if (opportunities.length > 0) {
      // Sort by utility and pick best
      opportunities.sort((a, b) => b.utility - a.utility);
      return opportunities[0];
    }

    // 3. Default/Idle behavior
    return {
      id: `idle_${Date.now()}`,
      type: "idle",
      priority: 0,
      description: "Idling",
      createdAt: Date.now(),
    };
  }

  /**
   * PHASE 1: Personality System
   */
  private derivePersonalityFromTraits(
    traits: AgentTraits,
    lifeStage: LifeStage,
  ): AgentPersonality {
    const isChild = lifeStage === "child";

    // Derive Big Five from traits
    const openness = (traits.curiosity + (traits.intelligence || 0.5)) / 2;
    const conscientiousness =
      (traits.diligence + (traits.cooperation || 0.5)) / 2;
    const extraversion =
      (traits.charisma || 0.5) + (traits.aggression || 0.5) / 2;
    const agreeableness =
      (traits.cooperation || 0.5) - (traits.aggression || 0.5) / 2;
    const neuroticism = 1 - (traits.bravery || 0.5);

    return {
      openness,
      conscientiousness,
      extraversion,
      agreeableness,
      neuroticism,
      // Derived behavioral tendencies
      riskTolerance: (traits.bravery || 0.5) * 0.7 + (traits.curiosity || 0.5) * 0.3,
      socialPreference: isChild
        ? 0.8
        : (traits.charisma || 0.5) * 0.6 + (traits.cooperation || 0.5) * 0.4,
      workEthic: isChild
        ? 0.3
        : (traits.diligence || 0.5) * 0.8 + (traits.stamina || 0.5) * 0.2,
      explorationType:
        (traits.curiosity || 0.5) > 0.7 ? "adventurous" : "cautious",
    };
  }

  private generatePersonalityFallback(): AgentPersonality {
    return {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
      riskTolerance: 0.5,
      socialPreference: 0.5,
      workEthic: 0.5,
      explorationType: "balanced",
    };
  }

  private createAIState(agentId: string): AIState {
    const agent = this.gameState.agents?.find((a) => a.id === agentId);
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
      agentId,
      personality,
      memory: {
        lastInteractionTime: {},
        visitedZones: new Set(),
        knownResources: new Map(),
        // Extended memory fields
        homeZoneId: undefined,
        successfulActivities: new Map(),
        failedAttempts: new Map(),
        lastExplorationTime: 0,
        lastMemoryCleanup: Date.now(),
      },
      currentGoal: null,
      currentAction: null,
      offDuty: false,
    };
  }

  /**
   * PHASE 2: Entity Arrival Logic
   */
  public notifyEntityArrived(entityId: string, zoneId: string): void {
    const aiState = this.aiStates.get(entityId);
    if (!aiState || !aiState.currentGoal) return;

    const goal = aiState.currentGoal;

    // Mark zone as visited
    aiState.memory.visitedZones.add(zoneId);

    // Handle assist goals
    if (goal.type.startsWith("assist_") && goal.data?.targetAgentId) {
      const targetId = goal.data.targetAgentId as string;
      const resourceType = goal.data.resourceType as string;
      const amount = (goal.data.amount as number) || 10;

      if (this.inventorySystem && this.socialSystem) {
        const inv = this.inventorySystem.getAgentInventory(entityId);
        if (inv && inv[resourceType as keyof typeof inv] >= amount) {
          this.inventorySystem.removeFromAgent(entityId, resourceType as any, amount);
          this.inventorySystem.addResource(targetId, resourceType as any, amount);
          this.socialSystem.registerFriendlyInteraction(entityId, targetId);
        }
      }
      aiState.currentGoal = null;
      return;
    }

    // Handle crafting weapon goals
    if (goal.type === "craft" && goal.data?.itemType === "weapon") {
      if (this.craftingSystem) {
        const weaponId = this.craftingSystem.craftBestWeapon(entityId);
        if (weaponId) {
          simulationEvents.emit(GameEventNames.ITEM_CRAFTED, {
            agentId: entityId,
            itemId: weaponId,
          });
        }
      }
      aiState.currentGoal = null;
      return;
    }

    // Handle deposit goals
    if (goal.type === "deposit" && zoneId) {
      this.tryDepositResources(entityId, zoneId);
      aiState.currentGoal = null;
      return;
    }

    // Handle guard duties
    if (this.roleSystem && this.socialSystem) {
      const role = this.roleSystem.getAgentRole(entityId);
      if (
        role?.type === "guard" &&
        (goal.targetZoneId || "").toLowerCase().includes("defense")
      ) {
        this.socialSystem.imposeLocalTruces(entityId, 140, 45000);
      }
    }

    // Pick appropriate activity for zone type
    const zone = this.gameState.zones?.find((z) => z.id === zoneId);
    if (zone) {
      const activity = this.pickActivityForZone(zone.type, goal);
      const duration = this.estimateActivityDuration(entityId, zone.type, goal);

      simulationEvents.emit(GameEventNames.AGENT_ACTIVITY_STARTED, {
        agentId: entityId,
        zoneId,
        activity,
        duration,
      });

      // Record successful visit
      const successCount = aiState.memory.successfulActivities?.get(zoneId) || 0;
      aiState.memory.successfulActivities?.set(zoneId, successCount + 1);
    }

    // Complete current goal
    aiState.currentGoal = null;
    this._goalsCompleted++;
  }

  private tryDepositResources(entityId: string, zoneId: string): void {
    if (!this.inventorySystem) return;

    const inv = this.inventorySystem.getAgentInventory(entityId);
    if (!inv) return;

    let stockpiles = this.inventorySystem.getStockpilesInZone(zoneId);
    if (stockpiles.length === 0) {
      const stockpile = this.inventorySystem.createStockpile(zoneId, "general");
      stockpiles = [stockpile];
    }

    const stockpile = stockpiles[0];
    const resourcesToTransfer = {
      wood: inv.wood,
      stone: inv.stone,
      food: inv.food,
      water: inv.water,
    };

    const transferred = this.inventorySystem.transferToStockpile(
      entityId,
      stockpile.id,
      resourcesToTransfer,
    );

    const totalTransferred =
      transferred.wood +
      transferred.stone +
      transferred.food +
      transferred.water;

    if (totalTransferred > 0) {
      simulationEvents.emit(GameEventNames.RESOURCES_DEPOSITED, {
        agentId: entityId,
        zoneId,
        stockpileId: stockpile.id,
        resources: transferred,
      });
    }
  }

  private pickActivityForZone(
    zoneType: string,
    _goal: AIGoal,
  ): "eating" | "resting" | "socializing" | "working" | "idle" {
    switch (zoneType) {
      case "food":
      case "water":
        return "eating";
      case "rest":
      case "shelter":
      case "house":
        return "resting";
      case "social":
      case "market":
      case "gathering":
        return "socializing";
      case "work":
      case "production":
      case "crafting":
        return "working";
      default:
        return "idle";
    }
  }

  private estimateActivityDuration(
    entityId: string,
    zoneType: string,
    goal: AIGoal,
  ): number {
    const baseDurations: Record<string, number> = {
      food: 4000,
      water: 2500,
      rest: 4000,
      shelter: 4000,
      social: 4000,
      work: 6000,
      default: 3000,
    };

    let baseDuration = baseDurations[zoneType] || baseDurations.default;

    if (this.needsSystem && goal.data?.need) {
      const needs = this.needsSystem.getNeeds(entityId);
      if (needs) {
        const needValue = needs[goal.data.need as keyof typeof needs] || 100;
        if (needValue < 30) {
          baseDuration *= 1.5;
        } else if (needValue < 50) {
          baseDuration *= 1.25;
        }
      }
    }

    return baseDuration;
  }

  /**
   * PHASE 3: Memory Management
   */
  private cleanupAgentMemory(now: number): void {
    for (const [agentId, aiState] of this.aiStates) {
      // 1. Limit visited zones
      if (aiState.memory.visitedZones.size > 100) {
        const zones = Array.from(aiState.memory.visitedZones);
        aiState.memory.visitedZones = new Set(zones.slice(-100));
      }

      // 2. Limit successful activities history
      if (aiState.memory.successfulActivities && aiState.memory.successfulActivities.size > 50) {
        const sorted = Array.from(aiState.memory.successfulActivities.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50);
        aiState.memory.successfulActivities = new Map(sorted);
      }

      aiState.memory.lastMemoryCleanup = now;
    }
  }

  private selectBestZone(
    aiState: AIState,
    zoneIds: string[],
    _zoneType: string,
  ): string | null {
    if (zoneIds.length === 0) return null;

    let bestZone = zoneIds[0];
    let bestScore = -Infinity;

    for (const zoneId of zoneIds) {
      let score = 0;

      // Bonus for successful history
      const successes = aiState.memory.successfulActivities?.get(zoneId) || 0;
      score += successes * 0.1;

      // Bonus for unvisited (exploration)
      if (!aiState.memory.visitedZones.has(zoneId)) {
        score += 0.3;
      }

      // Penalty for failures
      const failures = aiState.memory.failedAttempts?.get(zoneId) || 0;
      score -= failures * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestZone = zoneId;
      }
    }

    return bestZone;
  }

  /**
   * PHASE 4: Advanced Features
   */
  public setPlayerControl(entityId: string, controlled: boolean): void {
    if (controlled) {
      this.playerControlledAgents.add(entityId);
      // Clear current goal when player takes over
      const aiState = this.aiStates.get(entityId);
      if (aiState) {
        aiState.currentGoal = null;
        aiState.currentAction = null;
      }
    } else {
      this.playerControlledAgents.delete(entityId);
    }
  }

  public isPlayerControlled(entityId: string): boolean {
    return this.playerControlledAgents.has(entityId);
  }

  public setEntityPriority(
    entityId: string,
    priority: "survival" | "normal" | "social",
  ): void {
    this.agentPriorities.set(entityId, priority);
  }

  public getStatusSnapshot() {
    return {
      totalAgents: this.aiStates.size,
      activeGoals: Array.from(this.aiStates.values()).filter(s => s.currentGoal).length,
      playerControlled: this.playerControlledAgents.size,
      offDuty: Array.from(this.aiStates.values()).filter(s => s.offDuty).length,
      avgDecisionTime: this._decisionCount > 0 ? this._decisionTimeTotalMs / this._decisionCount : 0,
    };
  }

  public getPerformanceMetrics() {
    return {
      totalDecisions: this._decisionCount,
      avgDecisionTimeMs: this._decisionCount > 0 ? this._decisionTimeTotalMs / this._decisionCount : 0,
      goalsCompleted: this._goalsCompleted,
      goalsFailed: this._goalsFailed,
    };
  }

  public removeEntityAI(entityId: string): void {
    this.aiStates.delete(entityId);
    this.playerControlledAgents.delete(entityId);
    this.agentPriorities.delete(entityId);
    this.agentStrategies.delete(entityId);
  }

  public cleanup(): void {
    this.aiStates.clear();
    this.removeAllListeners();
  }

  // Helper methods
  private isGoalCompleted(goal: AIGoal, _agentId: string): boolean {
    // Simple check: if goal has been active too long, force complete/fail
    // In a real system, this would check world state
    return Date.now() - goal.createdAt > 60000; // 1 minute timeout
  }

  private isGoalInvalid(goal: AIGoal, _agentId: string): boolean {
    return false; // Placeholder
  }

  private completeGoal(aiState: AIState, _agentId: string): void {
    aiState.currentGoal = null;
    this._goalsCompleted++;
  }

  private failGoal(aiState: AIState, agentId: string): void {
    if (aiState.currentGoal?.targetZoneId) {
      const zoneId = aiState.currentGoal.targetZoneId;
      const fails = aiState.memory.failedAttempts?.get(zoneId) || 0;
      aiState.memory.failedAttempts?.set(zoneId, fails + 1);
    }
    aiState.currentGoal = null;
    this._goalsFailed++;
  }

  private planAction(agentId: string, goal: AIGoal): AgentAction | null {
    const timestamp = Date.now();

    switch (goal.type) {
      case "satisfy_hunger":
      case "satisfy_thirst":
      case "satisfy_energy":
      case "satisfy_social":
      case "satisfy_fun":
        return {
          actionType: "move",
          agentId,
          targetZoneId: goal.targetZoneId,
          targetPosition: goal.targetPosition,
          timestamp,
        };

      case "gather":
      case "work":
        return {
          actionType: "work",
          agentId,
          targetZoneId: goal.targetZoneId,
          timestamp,
        };

      case "deposit":
        return {
          actionType: "move",
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
