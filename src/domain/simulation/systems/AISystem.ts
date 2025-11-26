import { logger } from "../../../infrastructure/utils/logger";
import type { ResourceType } from "../../types/simulation/economy";
import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import {
  AIGoal,
  AIGoalData,
  AIState,
  AgentAction,
  AgentPersonality,
  GoalType,
} from "../../types/simulation/ai";
import type { AgentTraits, LifeStage } from "../../types/simulation/agents";
import type { WorldResourceType } from "../../types/simulation/worldResources";
import {
  toInventoryResource,
  isWorldResourceType,
} from "../../types/simulation/resourceMapping";
import { getAnimalConfig } from "../../../infrastructure/services/world/config/AnimalConfigs";
import type { WeaponId as CraftingWeaponId } from "../../types/simulation/crafting";
import { planGoals, type AgentGoalPlannerDeps } from "./ai/AgentGoalPlanner";
import { PriorityManager } from "./ai/PriorityManager";
import { GameEventNames } from "../core/events";
import { simulationEvents } from "../core/events";
import type { NeedsSystem } from "./NeedsSystem";
import { RoleSystem } from "./RoleSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { EnhancedCraftingSystem } from "./EnhancedCraftingSystem";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { HouseholdSystem } from "./HouseholdSystem";
import type { TaskSystem } from "./TaskSystem";
import type { CombatSystem } from "./CombatSystem";
import type { AnimalSystem } from "./AnimalSystem";
import type { MovementSystem } from "./MovementSystem";
import type { QuestSystem } from "./QuestSystem";
import type { TimeSystem, TimeOfDay } from "./TimeSystem";
import type { EntityIndex } from "../core/EntityIndex";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";
import { getFrameTime } from "../../../shared/FrameTime";

interface AISystemConfig {
  updateIntervalMs: number;
  enablePersonality: boolean;
  enableMemory: boolean;
  maxMemoryItems: number;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

/**
 * AI system for agent decision-making and goal planning.
 *
 * Processes agents in batches to maintain performance. Each agent has:
 * - Personality traits derived from agent traits
 * - Memory of visited zones, successful activities, and failed attempts
 * - Current goal and action being executed
 * - Goal queue for future planning
 *
 * Uses AgentGoalPlanner to evaluate and select goals based on needs, roles,
 * available resources, and social context.
 *
 * @see AgentGoalPlanner for goal selection logic
 * @see PriorityManager for need prioritization
 */
@injectable()
export class AISystem extends EventEmitter {
  private gameState: GameState;
  private config: AISystemConfig;
  private aiStates: Map<string, AIState>;
  private lastUpdate: number = Date.now();
  private priorityManager: PriorityManager;

  private needsSystem?: NeedsSystem;
  private roleSystem?: RoleSystem;
  private worldResourceSystem?: WorldResourceSystem;
  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;
  private craftingSystem?: EnhancedCraftingSystem;
  private householdSystem?: HouseholdSystem;
  private taskSystem?: TaskSystem;
  private combatSystem?: CombatSystem;
  private animalSystem?: AnimalSystem;
  private _movementSystem?: MovementSystem;
  private questSystem?: QuestSystem;
  private timeSystem?: TimeSystem;
  private entityIndex?: EntityIndex;

  private agentIndex = 0;

  private _lastMemoryCleanupTime = 0;
  private readonly MEMORY_CLEANUP_INTERVAL = 300000;

  private readonly BATCH_SIZE = 10;

  private zoneCache = new Map<string, string | undefined>();
  private craftingZoneCache: string | undefined | null = null;
  private activeAgentIdsCache: string[] | null = null;
  private lastCacheInvalidation = 0;
  private readonly CACHE_INVALIDATION_INTERVAL = 1000;

  private readonly MAX_DECISION_TIME_MS = 5;

  private agentStrategies = new Map<
    string,
    "peaceful" | "tit_for_tat" | "bully"
  >();
  private playerControlledAgents = new Set<string>();
  private agentPriorities = new Map<string, "survival" | "normal" | "social">();

  private _decisionTimeTotalMs = 0;
  private _decisionCount = 0;
  private _goalsCompleted = 0;
  private _goalsFailed = 0;

  /**
   * Creates a new AI system.
   *
   * @param gameState - Current game state
   * @param needsSystem - Optional needs system dependency
   * @param roleSystem - Optional role system dependency
   * @param worldResourceSystem - Optional world resource system dependency
   * @param inventorySystem - Optional inventory system dependency
   * @param socialSystem - Optional social system dependency
   * @param craftingSystem - Optional crafting system dependency
   * @param householdSystem - Optional household system dependency
   * @param taskSystem - Optional task system dependency
   * @param combatSystem - Optional combat system dependency
   * @param animalSystem - Optional animal system dependency
   * @param movementSystem - Optional movement system dependency
   * @param questSystem - Optional quest system dependency
   * @param timeSystem - Optional time system dependency
   * @param entityIndex - Optional entity index dependency
   */
  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.NeedsSystem) @optional() needsSystem?: NeedsSystem,
    @inject(TYPES.RoleSystem) @optional() roleSystem?: RoleSystem,
    @inject(TYPES.WorldResourceSystem)
    @optional()
    worldResourceSystem?: WorldResourceSystem,
    @inject(TYPES.InventorySystem)
    @optional()
    inventorySystem?: InventorySystem,
    @inject(TYPES.SocialSystem) @optional() socialSystem?: SocialSystem,
    @inject(TYPES.EnhancedCraftingSystem)
    @optional()
    craftingSystem?: EnhancedCraftingSystem,
    @inject(TYPES.HouseholdSystem)
    @optional()
    householdSystem?: HouseholdSystem,
    @inject(TYPES.TaskSystem) @optional() taskSystem?: TaskSystem,
    @inject(TYPES.CombatSystem) @optional() combatSystem?: CombatSystem,
    @inject(TYPES.AnimalSystem) @optional() animalSystem?: AnimalSystem,
    @inject(TYPES.MovementSystem) @optional() movementSystem?: MovementSystem,
    @inject(TYPES.QuestSystem) @optional() questSystem?: QuestSystem,
    @inject(TYPES.TimeSystem) @optional() timeSystem?: TimeSystem,
    @inject(TYPES.EntityIndex)
    @optional()
    entityIndex?: EntityIndex,
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.config = {
      updateIntervalMs: 1000,
      enablePersonality: true,
      enableMemory: true,
      maxMemoryItems: 50,
    };

    this.aiStates = new Map();
    this.priorityManager = new PriorityManager(
      gameState,
      undefined,
      roleSystem,
    );

    this.needsSystem = needsSystem;
    this.roleSystem = roleSystem;
    this.worldResourceSystem = worldResourceSystem;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
    this.craftingSystem = craftingSystem;
    this.householdSystem = householdSystem;
    this.taskSystem = taskSystem;
    this.combatSystem = combatSystem;
    this.animalSystem = animalSystem;
    this._movementSystem = movementSystem;
    this.questSystem = questSystem;
    this.timeSystem = timeSystem;

    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      this.handleActionComplete.bind(this),
    );
  }

  /**
   * Sets system dependencies after construction.
   * Allows for circular dependency resolution.
   *
   * @param systems - Object containing system dependencies
   */
  public setDependencies(systems: {
    needsSystem?: NeedsSystem;
    roleSystem?: RoleSystem;
    worldResourceSystem?: WorldResourceSystem;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
    craftingSystem?: EnhancedCraftingSystem;
    householdSystem?: HouseholdSystem;
    taskSystem?: TaskSystem;
    combatSystem?: CombatSystem;
    animalSystem?: AnimalSystem;
    movementSystem?: MovementSystem;
    questSystem?: QuestSystem;
    timeSystem?: TimeSystem;
  }): void {
    if (systems.needsSystem) this.needsSystem = systems.needsSystem;
    if (systems.roleSystem) this.roleSystem = systems.roleSystem;
    if (systems.worldResourceSystem)
      this.worldResourceSystem = systems.worldResourceSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
    if (systems.craftingSystem) this.craftingSystem = systems.craftingSystem;
    if (systems.householdSystem) this.householdSystem = systems.householdSystem;
    if (systems.taskSystem) this.taskSystem = systems.taskSystem;
    if (systems.combatSystem) this.combatSystem = systems.combatSystem;
    if (systems.animalSystem) this.animalSystem = systems.animalSystem;
    if (systems.movementSystem) this._movementSystem = systems.movementSystem;
    if (systems.questSystem) this.questSystem = systems.questSystem;
    if (systems.timeSystem) this.timeSystem = systems.timeSystem;
  }

  /**
   * Updates the AI system, processing agents in batches with yield to avoid blocking event loop.
   * Processes up to 5 agents per update, with micro-batches of 3 agents that yield to event loop.
   * Skips player-controlled agents and agents that are off-duty.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (not used, uses config interval)
   */
  public update(_deltaTimeMs: number): void {
    const now = getFrameTime();

    // Only update if enough time has passed according to config
    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }

    if (now - this._lastMemoryCleanupTime >= this.MEMORY_CLEANUP_INTERVAL) {
      this.cleanupAgentMemory(now);
      this._lastMemoryCleanupTime = now;
    }

    this.lastUpdate = now;
    const agents = this.gameState.agents || [];

    if (now - this.lastCacheInvalidation > this.CACHE_INVALIDATION_INTERVAL) {
      this.invalidateCache();
      this.lastCacheInvalidation = now;
    }

    const batchSize = Math.min(this.BATCH_SIZE, agents.length);

    if (Math.random() < 0.01) {
      logger.debug(
        `🧠 AISystem update: processing ${batchSize} agents (total: ${agents.length})`,
      );
    }

    for (let i = 0; i < batchSize; i++) {
      const idx = (this.agentIndex + i) % agents.length;
      const agent = agents[idx];

      if (this.playerControlledAgents.has(agent.id)) continue;

      let aiState = this.aiStates.get(agent.id);
      if (!aiState) {
        aiState = this.createAIState(agent.id);
        this.aiStates.set(agent.id, aiState);
      }

      if (aiState.offDuty) continue;

      try {
        this.processAgent(agent.id, aiState, now);
      } catch (error) {
        logger.error(`Error processing agent ${agent.id}`, { error });
      }
    }

    this.agentIndex = (this.agentIndex + batchSize) % agents.length;
  }

  /**
   * Invalidates cached evaluation results.
   * Called periodically to ensure cache doesn't become stale.
   */
  private invalidateCache(): void {
    this.zoneCache.clear();
    this.craftingZoneCache = null;
    this.activeAgentIdsCache = null;
  }

  /**
   * Processes a single agent's AI state.
   * Checks if current goal is completed or invalid, then makes a new decision if needed.
   *
   * @param agentId - Agent identifier
   * @param aiState - Agent's AI state
   * @param now - Current timestamp
   */
  private processAgent(agentId: string, aiState: AIState, now: number): void {
    if (aiState.currentGoal) {
      if (this.isGoalCompleted(aiState.currentGoal, agentId)) {
        this.completeGoal(aiState, agentId);
      } else if (this.isGoalInvalid(aiState.currentGoal, agentId)) {
        this.failGoal(aiState, agentId);
      } else if (aiState.currentAction) {
        return;
      }
    }

    if (!aiState.currentGoal) {
      const startTime = performance.now();
      const newGoal = this.makeDecision(agentId, aiState, now);
      const duration = performance.now() - startTime;

      this._decisionTimeTotalMs += duration;
      this._decisionCount++;

      performanceMonitor.recordSubsystemExecution(
        "AISystem",
        "makeDecision",
        duration,
        agentId,
      );

      if (newGoal) {
        aiState.currentGoal = newGoal;
        aiState.lastDecisionTime = now;
        logger.debug(
          `🎯 [AI] Agent ${agentId} new goal: ${newGoal.type} target=${newGoal.targetId || newGoal.targetZoneId || "none"}`,
        );
        simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
          agentId,
          newGoal,
          timestamp: now,
        });
      } else {
        // Fallback: if no goal was selected, trigger exploratory movement
        this.maybeFallbackExplore(agentId, aiState);
      }
    }

    if (aiState.currentGoal) {
      const action = this.planAction(agentId, aiState.currentGoal);
      if (action) {
        aiState.currentAction = action;

        logger.debug(
          `🏃 [AI] Agent ${agentId} action: ${action.actionType} -> ${action.targetId || JSON.stringify(action.targetPosition) || action.targetZoneId || "none"}`,
        );
        this.executeAction(action);
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
          agentId,
          action,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Fallback exploratory movement when no goal is selected.
   * Conditions:
   * - Inventory empty (no food, water, wood, stone) OR needs all > 70 (low urgency)
   * - Agent not already moving
   * - MovementSystem available
   * Action: pick a random point in radius and move there to stimulate discovery.
   */
  private maybeFallbackExplore(agentId: string, _aiState: AIState): void {
    if (!this._movementSystem) return;
    if (this._movementSystem.isMoving(agentId)) return;

    const inventory = this.inventorySystem?.getAgentInventory(agentId);
    const needs = this.needsSystem?.getNeeds(agentId);

    const inventoryEmpty = inventory
      ? (inventory.food || 0) +
          (inventory.water || 0) +
          (inventory.wood || 0) +
          (inventory.stone || 0) ===
        0
      : true;
    const needsSatisfied = needs
      ? needs.hunger > 70 && needs.thirst > 70 && needs.energy > 70
      : false;

    if (!inventoryEmpty && !needsSatisfied) return;

    const pos = this.getAgentPosition(agentId);
    if (!pos) return;

    const radius = 400 + Math.random() * 600; // encourage broader exploration
    const angle = Math.random() * Math.PI * 2;
    const targetX = pos.x + Math.cos(angle) * radius;
    const targetY = pos.y + Math.sin(angle) * radius;
    this._movementSystem.moveToPoint(agentId, targetX, targetY);
    logger.debug(`🚶 [AI] Fallback explore triggered for ${agentId}`);
  }

  /**
   * Makes a decision for an agent, selecting the best goal based on current state.
   * Uses AgentGoalPlanner to evaluate available goals and select the highest priority one.
   * Has a time limit to avoid blocking the event loop.
   *
   * @param agentId - Agent identifier
   * @param aiState - Agent's AI state
   * @returns Selected goal or null if no suitable goal found
   */
  private makeDecision(
    agentId: string,
    aiState: AIState,
    now: number,
  ): AIGoal | null {
    const t0 = performance.now();
    let goal: AIGoal | null = null;

    try {
      goal = this.processGoals(agentId, aiState, now);
    } catch (error) {
      logger.error(`Error in makeDecision for agent ${agentId}:`, error);
    }

    const d0 = performance.now() - t0;
    performanceMonitor.recordSubsystemExecution(
      "AISystem",
      "processGoals",
      d0,
      agentId,
    );

    // Warn if decision took too long
    if (d0 > this.MAX_DECISION_TIME_MS) {
      logger.debug(
        `⚠️ [AI] Decision for agent ${agentId} took ${d0.toFixed(2)}ms (>${this.MAX_DECISION_TIME_MS}ms threshold)`,
      );
    }

    if (d0 > this.MAX_DECISION_TIME_MS * 2 && !goal) {
      return this.getFallbackExplorationGoal(agentId, aiState);
    }

    return goal;
  }

  /**
   * Returns a simple fallback exploration goal when decision making takes too long.
   * This prevents blocking the event loop while still giving the agent something to do.
   *
   * @param agentId - Agent identifier
   * @param _aiState - Agent's AI state (unused but kept for consistency)
   * @returns Simple exploration goal
   */
  private getFallbackExplorationGoal(
    agentId: string,
    _aiState: AIState,
  ): AIGoal | null {
    const pos = this.getAgentPosition(agentId);
    if (!pos) return null;

    // Return a simple exploration goal
    return {
      id: `explore-${agentId}-${Date.now()}`,
      type: "explore",
      priority: 0.5,
      targetPosition: {
        x: pos.x + (Math.random() - 0.5) * 200,
        y: pos.y + (Math.random() - 0.5) * 200,
      },
      createdAt: getFrameTime(),
    };
  }

  private processGoals(
    _agentId: string,
    aiState: AIState,
    now: number,
  ): AIGoal | null {
    const deps: AgentGoalPlannerDeps = {
      gameState: this.gameState,
      priorityManager: this.priorityManager,
      getEntityNeeds: (id: string) => this.needsSystem?.getNeeds(id),
      findNearestResource: (id: string, resourceType: string) => {
        return this.findNearestResourceForEntity(id, resourceType);
      },
      getAgentRole: (id: string) => this.roleSystem?.getAgentRole(id),
      getAgentInventory: (id: string) =>
        this.inventorySystem?.getAgentInventory(id),
      getCurrentZone: (id: string) => {
        if (this.zoneCache.has(id)) {
          return this.zoneCache.get(id);
        }
        const agent =
          this.entityIndex?.getAgent(id) ??
          this.gameState.agents.find((a) => a.id === id);
        if (!agent?.position) {
          this.zoneCache.set(id, undefined);
          return undefined;
        }
        const zone = this.gameState.zones.find((z) => {
          return (
            agent.position &&
            agent.position.x >= z.bounds.x &&
            agent.position.x <= z.bounds.x + z.bounds.width &&
            agent.position.y >= z.bounds.y &&
            agent.position.y <= z.bounds.y + z.bounds.height
          );
        });
        const zoneId = zone?.id;
        this.zoneCache.set(id, zoneId);
        return zoneId;
      },
      getEquipped: (id: string) =>
        this.combatSystem?.getEquipped(id) || "unarmed",
      getSuggestedCraftZone: () => {
        if (this.craftingZoneCache !== null) {
          return this.craftingZoneCache;
        }
        const zone = this.gameState.zones?.find((z) => z.type === "crafting");
        this.craftingZoneCache = zone?.id;
        return this.craftingZoneCache;
      },
      canCraftWeapon: (id: string, weaponId: string) => {
        if (!this.craftingSystem) return false;
        const validWeaponIds: CraftingWeaponId[] = [
          "wooden_club",
          "stone_dagger",
        ];
        if (!validWeaponIds.includes(weaponId as CraftingWeaponId)) {
          return false;
        }
        return this.craftingSystem.canCraftWeapon(
          id,
          weaponId as CraftingWeaponId,
        );
      },
      getAllActiveAgentIds: () => {
        if (this.activeAgentIdsCache !== null) {
          return this.activeAgentIdsCache;
        }
        const activeIds: string[] = [];
        for (const agent of this.gameState.agents) {
          if (!agent.isDead) activeIds.push(agent.id);
        }
        this.activeAgentIdsCache = activeIds;
        return activeIds;
      },
      getEntityStats: (id: string) => {
        const entity = this.gameState.entities?.find((e) => e.id === id);
        return entity?.stats
          ? {
              health: entity.stats.health ?? 100,
              stamina: entity.stats.stamina ?? 100,
              attack: entity.stats.attack ?? 10,
              defense: entity.stats.defense ?? 0,
            }
          : null;
      },
      getPreferredResourceForRole: (role: string) =>
        this.roleSystem?.getPreferredResourceForRole(role),
      getStrategy: (id: string) => this.agentStrategies.get(id) || "peaceful",
      isWarrior: (id: string) =>
        this.roleSystem?.getAgentRole(id)?.roleType === "guard",
      getNearbyPredators: (pos, range) => {
        return (
          this.animalSystem
            ?.getAnimalsInRadius(pos, range)
            .filter((a) => getAnimalConfig(a.type)?.isPredator)
            .map((a) => ({ id: a.id, position: a.position })) || []
        );
      },
      getEnemiesForAgent: (id, threshold) =>
        this.combatSystem?.getNearbyEnemies(id, threshold) || [],
      getTasks: () => this.taskSystem?.getActiveTasks() || [],
      getActiveQuests: () => this.questSystem?.getActiveQuests() || [],
      getAvailableQuests: () => this.questSystem?.getAvailableQuests() || [],
      getCurrentTimeOfDay: () => {
        return (this.timeSystem?.getCurrentTime().phase ||
          "morning") as TimeOfDay["phase"];
      },
      getEntityPosition: (id: string) => this.getAgentPosition(id) || null,
    };

    const goals = planGoals(deps, aiState, now);
    return goals.length > 0 ? goals[0] : null;
  }

  private derivePersonalityFromTraits(
    traits: AgentTraits,
    lifeStage: LifeStage,
  ): AgentPersonality {
    const isChild = lifeStage === "child";

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
        ? "extroverted"
        : (traits.charisma || 0.5) * 0.6 + (traits.cooperation || 0.5) * 0.4 >
            0.6
          ? "extroverted"
          : (traits.charisma || 0.5) * 0.6 + (traits.cooperation || 0.5) * 0.4 <
              0.4
            ? "introverted"
            : "balanced",
      workEthic: isChild
        ? "lazy"
        : (traits.diligence || 0.5) * 0.8 + (traits.stamina || 0.5) * 0.2 > 0.7
          ? "workaholic"
          : (traits.diligence || 0.5) * 0.8 + (traits.stamina || 0.5) * 0.2 <
              0.3
            ? "lazy"
            : "balanced",
      explorationType:
        (traits.curiosity || 0.5) > 0.7 ? "adventurous" : "cautious",
    };
  }

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
      socialPreference: "balanced",
      workEthic: "balanced",
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
   * Notifies the AI system that an entity has arrived at a zone.
   * Handles goal completion for zone-based goals and executes zone-specific actions.
   *
   * @param entityId - Entity identifier
   * @param zoneId - Zone identifier where entity arrived
   */
  public notifyEntityArrived(entityId: string, zoneId?: string): void {
    const aiState = this.aiStates.get(entityId);
    if (!aiState) return;

    if (aiState.currentAction?.actionType === "move") {
      this.handleActionComplete({
        agentId: entityId,
        success: true,
        actionType: "move",
      });
    }

    if (!aiState.currentGoal) return;

    const goal = aiState.currentGoal;

    if (zoneId) {
      aiState.memory.visitedZones.add(zoneId);

      // Update home zone if this is a rest/shelter zone and agent doesn't have a home
      if (!aiState.memory.homeZoneId && this.householdSystem) {
        const zone = this.gameState.zones?.find((z) => z.id === zoneId);
        if (
          zone &&
          (zone.type === "rest" ||
            zone.type === "shelter" ||
            zone.type === "house")
        ) {
          const household =
            this.householdSystem.findHouseholdForAgent(entityId);
          if (household && household.zoneId === zoneId) {
            aiState.memory.homeZoneId = zoneId;
          }
        }
      }
    }

    if (
      goal.type.startsWith("assist_") &&
      goal.data &&
      goal.data.targetAgentId
    ) {
      const targetId = goal.data.targetAgentId as string;
      const resourceType = goal.data.resourceType as string;
      const amount = (goal.data.amount as number) || 10;

      if (this.inventorySystem && this.socialSystem) {
        const inv = this.inventorySystem.getAgentInventory(entityId);
        if (!inv) return;
        const resourceValue = inv[resourceType as keyof typeof inv];
        if (typeof resourceValue === "number" && resourceValue >= amount) {
          this.inventorySystem.removeFromAgent(
            entityId,
            resourceType as ResourceType,
            amount,
          );
          this.inventorySystem.addResource(
            targetId,
            resourceType as ResourceType,
            amount,
          );
          this.socialSystem.registerFriendlyInteraction(entityId, targetId);
        }
      }
      aiState.currentGoal = null;
      return;
    }

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

    if (goal.type === "deposit" && zoneId) {
      this.tryDepositResources(entityId, zoneId);
      aiState.currentGoal = null;
      return;
    }

    if (this.roleSystem && this.socialSystem) {
      const role = this.roleSystem.getAgentRole(entityId);
      if (
        role?.roleType === "guard" &&
        (goal.targetZoneId || "").toLowerCase().includes("defense")
      ) {
        this.socialSystem.imposeLocalTruces(entityId, 140, 45000);
      }
    }

    const zone = this.gameState.zones?.find((z) => z.id === zoneId);
    if (zone && zoneId) {
      const activity = this.pickActivityForZone(zone.type, goal);
      const duration = this.estimateActivityDuration(entityId, zone.type, goal);

      simulationEvents.emit(GameEventNames.AGENT_ACTIVITY_STARTED, {
        agentId: entityId,
        zoneId,
        activity,
        duration,
      });

      const successCount =
        aiState.memory.successfulActivities?.get(zoneId) || 0;
      aiState.memory.successfulActivities?.set(zoneId, successCount + 1);
    }

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

  private cleanupAgentMemory(now: number): void {
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

      aiState.memory.lastMemoryCleanup = now;
    }
  }

  /**
   * Sets whether an entity is player-controlled.
   * Player-controlled entities skip AI processing.
   *
   * @param entityId - Entity identifier
   * @param controlled - Whether the entity is player-controlled
   */
  public setPlayerControl(entityId: string, controlled: boolean): void {
    if (controlled) {
      this.playerControlledAgents.add(entityId);
      const aiState = this.aiStates.get(entityId);
      if (aiState) {
        aiState.currentGoal = null;
        aiState.currentAction = null;
      }
    } else {
      this.playerControlledAgents.delete(entityId);
    }
  }

  /**
   * Checks if an entity is player-controlled.
   *
   * @param entityId - Entity identifier
   * @returns True if player-controlled
   */
  public isPlayerControlled(entityId: string): boolean {
    return this.playerControlledAgents.has(entityId);
  }

  /**
   * Sets the priority mode for an entity.
   *
   * @param entityId - Entity identifier
   * @param priority - Priority mode ("survival", "normal", or "social")
   */
  public setEntityPriority(
    entityId: string,
    priority: "survival" | "normal" | "social",
  ): void {
    this.agentPriorities.set(entityId, priority);
  }

  /**
   * Gets a status snapshot of the AI system.
   *
   * @returns Status metrics including agent counts and decision times
   */
  public getStatusSnapshot(): Record<string, number> {
    return {
      totalAgents: this.aiStates.size,
      activeGoals: [...this.aiStates.values()].filter((s) => s.currentGoal)
        .length,
      playerControlled: this.playerControlledAgents.size,
      offDuty: [...this.aiStates.values()].filter((s) => s.offDuty).length,
      avgDecisionTime:
        this._decisionCount > 0
          ? this._decisionTimeTotalMs / this._decisionCount
          : 0,
    };
  }

  /**
   * Gets performance metrics for the AI system.
   *
   * @returns Performance metrics including decision counts and goal completion rates
   */
  public getPerformanceMetrics(): Record<string, number> {
    return {
      totalDecisions: this._decisionCount,
      avgDecisionTimeMs:
        this._decisionCount > 0
          ? this._decisionTimeTotalMs / this._decisionCount
          : 0,
      goalsCompleted: this._goalsCompleted,
      goalsFailed: this._goalsFailed,
    };
  }

  /**
   * Removes AI state for an entity.
   *
   * @param entityId - Entity identifier to remove
   */
  public removeEntityAI(entityId: string): void {
    this.aiStates.delete(entityId);
    this.playerControlledAgents.delete(entityId);
    this.agentPriorities.delete(entityId);
    this.agentStrategies.delete(entityId);
  }

  /**
   * Cleans up all AI states and removes all event listeners.
   */
  public cleanup(): void {
    this.aiStates.clear();
    this.removeAllListeners();
  }

  private isGoalCompleted(goal: AIGoal, agentId: string): boolean {
    const now = Date.now();

    if (goal.expiresAt && now > goal.expiresAt) {
      return true;
    }

    const GOAL_TIMEOUT_MS = 60000;
    if (now - goal.createdAt > GOAL_TIMEOUT_MS) {
      return false;
    }

    if (goal.type.startsWith("satisfy_")) {
      const needType = goal.data?.need as string;
      if (needType && this.needsSystem) {
        const needs = this.needsSystem.getNeeds(agentId);
        if (needs) {
          const needValue = needs[needType as keyof typeof needs] as number;
          if (needValue > 70) {
            return true;
          }
        }
      }
    }

    if (goal.targetZoneId) {
      const zone = this.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone) {
        return false;
      }
    }

    if (goal.targetId && goal.data?.resourceType) {
      const resourceTypeStr = goal.data.resourceType as string;
      if (this.worldResourceSystem) {
        if (isWorldResourceType(resourceTypeStr)) {
          const resources =
            this.worldResourceSystem.getResourcesByType(resourceTypeStr);
          const targetResource = resources.find((r) => r.id === goal.targetId);
          if (!targetResource || targetResource.state !== "pristine") {
            return false;
          }
        } else {
          return false;
        }
      } else if (this.gameState.worldResources) {
        const resource = this.gameState.worldResources[goal.targetId];
        if (!resource || resource.state !== "pristine") {
          return false;
        }
      }
    }

    if (goal.type.startsWith("assist_") && goal.data?.targetAgentId) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.gameState.agents?.find((a) => a.id === targetId);
      if (!targetAgent) {
        return false;
      }

      // If it's a social assist, check if needs are satisfied
      if (goal.data.resourceType === "social" && this.needsSystem) {
        const needs = this.needsSystem.getNeeds(targetId);
        if (needs && (needs.social > 70 || needs.fun > 70)) {
          return true;
        }
      }
    }

    return false;
  }

  private isGoalInvalid(goal: AIGoal, agentId: string): boolean {
    if (goal.expiresAt && Date.now() > goal.expiresAt) {
      return true;
    }

    if (goal.targetZoneId) {
      const zone = this.gameState.zones?.find(
        (z) => z.id === goal.targetZoneId,
      );
      if (!zone) {
        return true;
      }
    }

    if (goal.targetId && goal.data?.resourceType) {
      const resourceTypeStr = goal.data.resourceType as string;
      if (this.worldResourceSystem) {
        if (isWorldResourceType(resourceTypeStr)) {
          const resources =
            this.worldResourceSystem.getResourcesByType(resourceTypeStr);
          const targetResource = resources.find((r) => r.id === goal.targetId);
          if (!targetResource || targetResource.state !== "pristine") {
            return true;
          }
        } else {
          return true;
        }
      } else if (this.gameState.worldResources) {
        const resource = this.gameState.worldResources[goal.targetId];
        if (!resource || resource.state !== "pristine") {
          return true;
        }
      }
    }

    if (goal.type.startsWith("assist_") && goal.data?.targetAgentId) {
      const targetId = goal.data.targetAgentId as string;
      const targetAgent = this.gameState.agents?.find((a) => a.id === targetId);
      if (!targetAgent) {
        return true;
      }
    }

    const agent = this.gameState.agents?.find((a) => a.id === agentId);
    if (!agent) {
      return true;
    }

    if (goal.type.startsWith("satisfy_")) {
      const needType = goal.data?.need as string;
      if (needType && this.needsSystem) {
        const needs = this.needsSystem.getNeeds(agentId);
        if (needs) {
          const needValue = needs[needType as keyof typeof needs] as number;
          if (needValue > 85) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private completeGoal(aiState: AIState, _agentId: string): void {
    aiState.currentGoal = null;
    aiState.lastDecisionTime = getFrameTime();
    this._goalsCompleted++;
  }

  private failGoal(aiState: AIState, _agentId: string): void {
    if (aiState.currentGoal?.targetZoneId) {
      const zoneId = aiState.currentGoal.targetZoneId;
      const fails = aiState.memory.failedAttempts?.get(zoneId) || 0;
      aiState.memory.failedAttempts?.set(zoneId, fails + 1);
    }
    aiState.currentGoal = null;
    aiState.lastDecisionTime = getFrameTime();
    this._goalsFailed++;
  }

  private planAction(agentId: string, goal: AIGoal): AgentAction | null {
    const timestamp = Date.now();

    switch (goal.type) {
      case "satisfy_need":
        if (goal.targetId && goal.targetPosition) {
          const agentPos = this.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - goal.targetPosition.x,
              agentPos.y - goal.targetPosition.y,
            );
            if (dist < 60) {
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
          return {
            actionType: "idle",
            agentId,
            timestamp,
          };
        }
        return null;

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
        if (goal.targetId && goal.targetPosition) {
          const agentPos = this.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - goal.targetPosition.x,
              agentPos.y - goal.targetPosition.y,
            );
            if (dist < 60) {
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
        return {
          actionType: "work",
          agentId,
          targetZoneId: goal.targetZoneId,
          timestamp,
        };

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

      case "flee":
        if (goal.targetPosition) {
          return {
            actionType: "move",
            agentId,
            targetPosition: goal.targetPosition,
            timestamp,
          };
        }
        return null;

      case "attack":
        if (goal.targetId && goal.targetPosition) {
          const agentPos = this.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - goal.targetPosition.x,
              agentPos.y - goal.targetPosition.y,
            );
            if (dist < 40) {
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

      case "assist":
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

      case "explore": {
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
        const currentPos = this.getAgentPosition(agentId);
        if (currentPos) {
          return {
            actionType: "move",
            agentId,
            targetPosition: {
              x: currentPos.x + (Math.random() - 0.5) * 200,
              y: currentPos.y + (Math.random() - 0.5) * 200,
            },
            timestamp,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  private getAgentPosition(agentId: string): { x: number; y: number } | null {
    const agent =
      this.entityIndex?.getAgent(agentId) ??
      this.gameState.agents.find((a) => a.id === agentId);
    if (agent?.position) {
      return { x: agent.position.x, y: agent.position.y };
    }
    return null;
  }

  /**
   * Gets the AI state for an agent.
   *
   * @param agentId - Agent identifier
   * @returns AI state or undefined if not found
   */
  public getAIState(agentId: string): AIState | undefined {
    return this.aiStates.get(agentId);
  }

  /**
   * Gets all AI states.
   *
   * @returns Array of all AI states
   */
  public getAllAIStates(): AIState[] {
    return Array.from(this.aiStates.values());
  }

  /**
   * Sets whether an agent is off-duty (skips AI processing).
   *
   * @param agentId - Agent identifier
   * @param offDuty - Whether the agent is off-duty
   */
  public setAgentOffDuty(agentId: string, offDuty: boolean): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.offDuty = offDuty;
      if (offDuty) {
        aiState.currentGoal = null;
      }
    }
  }

  /**
   * Forces goal reevaluation for an agent on the next update.
   *
   * @param agentId - Agent identifier
   */
  public forceGoalReevaluation(agentId: string): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.currentGoal = null;
      aiState.currentAction = null;
    }
  }

  /**
   * Fails the current goal for an agent.
   *
   * @param agentId - Agent identifier
   */
  public failCurrentGoal(agentId: string): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      this.failGoal(aiState, agentId);
    }
  }

  private findNearestResourceForEntity(
    entityId: string,
    resourceType: string,
  ): { id: string; x: number; y: number } | null {
    if (this.worldResourceSystem) {
      const resources = this.worldResourceSystem.getResourcesByType(
        resourceType as WorldResourceType,
      );
      if (resources.length === 0) return null;

      const agent = this.gameState.agents?.find((a) => a.id === entityId);
      if (!agent?.position) return null;

      let nearest: { id: string; x: number; y: number } | null = null;
      let minDistance = Infinity;

      for (const resource of resources) {
        if (resource.state !== "pristine") continue;

        const dx = resource.position.x - agent.position.x;
        const dy = resource.position.y - agent.position.y;
        const dist = dx * dx + dy * dy;

        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            id: resource.id,
            x: resource.position.x,
            y: resource.position.y,
          };
        }
      }

      return nearest;
    }

    if (!this.gameState.worldResources) return null;

    const agent = this.gameState.agents?.find((a) => a.id === entityId);
    if (!agent?.position) return null;

    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    for (const resource of Object.values(this.gameState.worldResources)) {
      if (resource.type === resourceType && resource.state === "pristine") {
        const dx = resource.position.x - agent.position.x;
        const dy = resource.position.y - agent.position.y;
        const dist = dx * dx + dy * dy;

        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            id: resource.id,
            x: resource.position.x,
            y: resource.position.y,
          };
        }
      }
    }

    return nearest;
  }

  private handleActionComplete(payload: {
    agentId: string;
    success: boolean;
    actionType?: string;
    data?: Record<string, unknown>;
  }): void {
    const aiState = this.aiStates.get(payload.agentId);
    if (aiState) {
      aiState.currentAction = null;
      if (payload.success) {
        // If action was work, check if task is actually completed
        if (
          payload.actionType === "work" &&
          payload.data &&
          typeof payload.data.taskId === "string"
        ) {
          const task = this.taskSystem?.getTask(payload.data.taskId);
          if (task && !task.completed) {
            // Task not done, don't complete goal yet
            return;
          }
        }
        this.completeGoal(aiState, payload.agentId);
      } else {
        this.failGoal(aiState, payload.agentId);
      }
    }
  }

  private executeAction(action: AgentAction): void {
    if (!this._movementSystem) return;

    switch (action.actionType) {
      case "move":
        if (action.targetZoneId) {
          if (
            this._movementSystem.isMovingToZone(
              action.agentId,
              action.targetZoneId,
            )
          ) {
            return;
          }
          this._movementSystem.moveToZone(action.agentId, action.targetZoneId);
        } else if (action.targetPosition) {
          if (
            this._movementSystem.isMovingToPosition(
              action.agentId,
              action.targetPosition.x,
              action.targetPosition.y,
            )
          ) {
            return;
          }
          this._movementSystem.moveToPoint(
            action.agentId,
            action.targetPosition.x,
            action.targetPosition.y,
          );
        }
        break;
      case "work":
        this.executeWorkAction(action);
        break;

      case "harvest":
        if (action.targetId && this.worldResourceSystem) {
          const result = this.worldResourceSystem.harvestResource(
            action.targetId,
            action.agentId,
          );

          if (result.success) {
            const resource = this.gameState.worldResources?.[action.targetId];
            if (resource) {
              // Use type-safe resource mapping
              const inventoryResourceType = toInventoryResource(resource.type);

              // Satisfy immediate needs based on resource type
              if (resource.type === "water_source" && this.needsSystem) {
                this.needsSystem.satisfyNeed(action.agentId, "thirst", 30);
              } else if (
                ["berry_bush", "mushroom_patch", "wheat_crop"].includes(
                  resource.type,
                ) &&
                this.needsSystem
              ) {
                this.needsSystem.satisfyNeed(action.agentId, "hunger", 25);
              }

              // Add to inventory if mapping exists
              if (inventoryResourceType && this.inventorySystem) {
                const added = this.inventorySystem.addResource(
                  action.agentId,
                  inventoryResourceType,
                  result.amount,
                );
                if (added) {
                  logger.debug(
                    `🎒 [AI] Agent ${action.agentId} added ${result.amount} ${inventoryResourceType} to inventory`,
                  );
                }
              }
            }
          }

          simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
            agentId: action.agentId,
            actionType: "harvest",
            success: result.success,
            data: { amount: result.amount },
          });
        }
        break;
      case "idle":
        if (this.needsSystem) {
          this.needsSystem.satisfyNeed(action.agentId, "energy", 5);
        }
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
          agentId: action.agentId,
          actionType: "idle",
          success: true,
        });
        break;
      default:
        break;
    }
  }

  /**
   * Executes a work action for an agent.
   * Checks if the agent is in the target zone and contributes to the task if so.
   * Otherwise, moves the agent to the target zone.
   *
   * @param action - The action to execute.
   */
  private executeWorkAction(action: AgentAction): void {
    if (!action.targetZoneId) return;

    if (
      this._movementSystem?.isMovingToZone(action.agentId, action.targetZoneId)
    ) {
      return;
    }

    const agentPos = this.getAgentPosition(action.agentId);
    const zone = this.gameState.zones?.find(
      (z) => z.id === action.targetZoneId,
    );

    if (agentPos && zone && zone.bounds) {
      const inZone =
        agentPos.x >= zone.bounds.x &&
        agentPos.x <= zone.bounds.x + zone.bounds.width &&
        agentPos.y >= zone.bounds.y &&
        agentPos.y <= zone.bounds.y + zone.bounds.height;

      if (inZone) {
        if (this.taskSystem && action.data?.taskId) {
          const result = this.taskSystem.contributeToTask(
            action.data.taskId as string,
            action.agentId,
            10, // Base contribution
            1.0, // Synergy
          );

          simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
            agentId: action.agentId,
            actionType: "work",
            success: true,
            data: {
              taskId: action.data.taskId,
              progressMade: result.progressMade,
              completed: result.completed,
            },
          });
          return;
        }
      }
    }

    this._movementSystem?.moveToZone(action.agentId, action.targetZoneId);
  }
  // IAIPort implementation
  public setGoal(
    agentId: string,
    goal: {
      type: string;
      priority: number;
      targetId?: string;
      targetZoneId?: string;
      data?: Record<string, unknown>;
    },
  ): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      // Convert goal.type to GoalType and validate
      const goalType = goal.type as GoalType;
      // Convert goal.data to AIGoalData format
      const goalData: AIGoalData | undefined = goal.data
        ? {
            ...Object.fromEntries(
              Object.entries(goal.data).map(([k, v]) => [
                k,
                typeof v === "string" || typeof v === "number" ? v : undefined,
              ]),
            ),
          }
        : undefined;

      const newGoal: AIGoal = {
        id: `external_${Date.now()}`,
        type: goalType,
        priority: goal.priority,
        targetId: goal.targetId,
        targetZoneId: goal.targetZoneId,
        data: goalData,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000, // Default 1 min expiry for external goals
      };
      aiState.currentGoal = newGoal;
      simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
        agentId,
        newGoal,
        timestamp: Date.now(),
      });
    }
  }

  public clearGoals(agentId: string): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.currentGoal = null;
      aiState.goalQueue = [];
    }
  }

  public getCurrentGoal(agentId: string): unknown {
    const aiState = this.aiStates.get(agentId);
    return aiState?.currentGoal;
  }
}
