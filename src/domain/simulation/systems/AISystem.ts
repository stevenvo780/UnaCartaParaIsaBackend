import { logger } from "../../../infrastructure/utils/logger";
import type { ResourceType } from "../../types/simulation/economy";
import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import {
  AIGoal,
  AIGoalData,
  AIState,
  AgentAction,
  GoalType,
} from "../../types/simulation/ai";
import type { WorldResourceType } from "../../types/simulation/worldResources";
import { StockpileType } from "../../../shared/constants/ZoneEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { getAnimalConfig } from "../../../infrastructure/services/world/config/AnimalConfigs";
import type { WeaponId as CraftingWeaponId } from "../../types/simulation/crafting";

/**
 * Generates a human-readable description of an AI goal.
 * @param goal - The AI goal to describe
 * @returns A descriptive string of what the agent is doing
 */
function describeGoal(goal: AIGoal): string {
  const { type, targetId, targetZoneId, data } = goal;
  const parts: string[] = [type];
  if (data?.workType) {
    parts.push(`(${data.workType})`);
  }

  if (data?.taskType) {
    parts.push(`task:${data.taskType}`);
  }

  if (data?.resourceType) {
    parts.push(`resource:${data.resourceType}`);
  }

  if (data?.buildingType) {
    parts.push(`building:${data.buildingType}`);
  }

  if (data?.need) {
    parts.push(`need:${data.need}`);
  }

  if (data?.reason) {
    parts.push(`reason:${data.reason}`);
  }

  if (targetId) {
    const readableTarget = targetId
      .replace(/^resource_/, "")
      .replace(/_\d+_\w+$/, "")
      .replace(/_/g, " ");
    parts.push(`-> ${readableTarget}`);
  } else if (targetZoneId) {
    parts.push(`-> zone:${targetZoneId}`);
  }

  return parts.join(" ");
}

/**
 * Generates a human-readable description of an AI action.
 * @param action - The agent action to describe
 * @returns A descriptive string of the action
 */
function describeAction(action: AgentAction): string {
  const parts: string[] = [action.actionType];

  if (action.targetId) {
    const readableTarget = action.targetId
      .replace(/^resource_/, "")
      .replace(/_\d+_\w+$/, "")
      .replace(/_/g, " ");
    parts.push(`-> ${readableTarget}`);
  } else if (action.targetPosition) {
    parts.push(
      `-> (${Math.round(action.targetPosition.x)}, ${Math.round(action.targetPosition.y)})`,
    );
  } else if (action.targetZoneId) {
    parts.push(`-> zone:${action.targetZoneId}`);
  }

  return parts.join(" ");
}
import {
  planGoals,
  type AgentGoalPlannerDeps,
} from "./ai/core/AgentGoalPlanner";
import { PriorityManager } from "./ai/core/PriorityManager";
import { AIStateManager } from "./ai/core/AIStateManager";
import { AIGoalValidator } from "./ai/core/AIGoalValidator";
import { AIActionPlanner } from "./ai/core/AIActionPlanner";
import { AIActionExecutor } from "./ai/core/AIActionExecutor";
import { AIUrgentGoals } from "./ai/core/AIUrgentGoals";
import { AIZoneHandler } from "./ai/core/AIZoneHandler";
import { GameEventNames } from "../core/events";
import { simulationEvents } from "../core/events";
import type { NeedsSystem } from "./NeedsSystem";
import { RoleSystem } from "./RoleSystem";
import type { InventorySystem } from "./InventorySystem";
import type {
  ResourceAlert,
  ThreatAlert,
  SharedKnowledgeSystem,
} from "./SharedKnowledgeSystem";
import type { SocialSystem } from "./SocialSystem";
import type { EnhancedCraftingSystem } from "./EnhancedCraftingSystem";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { HouseholdSystem } from "./HouseholdSystem";
import type { TaskSystem } from "./TaskSystem";
import type { TaskCreationParams } from "../../types/simulation/tasks";
import type { CombatSystem } from "./CombatSystem";
import type { AnimalSystem } from "./AnimalSystem";
import type { MovementSystem } from "./MovementSystem";
import type { QuestSystem } from "./QuestSystem";
import type { TimeSystem, TimeOfDay } from "./TimeSystem";
import type { EntityIndex } from "../core/EntityIndex";
import type { GPUComputeService } from "../core/GPUComputeService";
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

  private stateManager!: AIStateManager;
  private goalValidator!: AIGoalValidator;
  private actionPlanner!: AIActionPlanner;
  private actionExecutor!: AIActionExecutor;
  private urgentGoals!: AIUrgentGoals;
  private zoneHandler!: AIZoneHandler;

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
  private sharedKnowledgeSystem?: SharedKnowledgeSystem;
  private entityIndex?: EntityIndex;
  private gpuService?: GPUComputeService;

  private agentIndex = 0;

  private _lastMemoryCleanupTime = 0;
  private readonly MEMORY_CLEANUP_INTERVAL = 300000;

  /**
   * Batch size for agent processing per update.
   * With updateInterval=250ms, processing 10 agents ensures all agents
   * get updated within 250-500ms for responsive behavior.
   */
  private readonly BATCH_SIZE = 10;

  private zoneCache = new Map<string, string | undefined>();
  private craftingZoneCache: string | undefined | null = null;
  private activeAgentIdsCache: string[] | null = null;
  private lastCacheInvalidation = 0;
  private readonly CACHE_INVALIDATION_INTERVAL = 1000;

  private nearestResourceCache = new Map<
    string,
    { resource: { id: string; x: number; y: number } | null; timestamp: number }
  >();
  private readonly RESOURCE_CACHE_TTL = 2000; // 2s cache for resource searches
  private readonly MAX_RESOURCE_SEARCH_RADIUS = 2000; // Increased to cover most of the map

  // Resource reservation: tracks which agent is targeting which resource
  // Prevents multiple agents from going to the same resource
  private resourceReservations = new Map<string, string>(); // resourceId -> agentId

  private readonly MAX_DECISION_TIME_MS = 5;

  private readonly EXPLORE_RANGE = 200;

  private readonly boundHandleActionComplete: (payload: {
    agentId: string;
    success: boolean;
    actionType?: string;
    data?: Record<string, unknown>;
  }) => void;

  private agentStrategies = new Map<
    string,
    "peaceful" | "tit_for_tat" | "bully"
  >();
  private playerControlledAgents = new Set<string>();
  private agentPriorities = new Map<string, "survival" | "normal" | "social">();

  private _decisionTimeTotalMs = 0;
  private _decisionCount = 0;
  private _goalsCompletedRef = { value: 0 };

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
    @inject(TYPES.GPUComputeService)
    @optional()
    gpuService?: GPUComputeService,
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.gpuService = gpuService;
    this.config = {
      updateIntervalMs: 250, // Match scheduler MEDIUM rate for responsive AI
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

    this.initializeSubsystems();

    this.boundHandleActionComplete = this.handleActionComplete.bind(this);
    // Listen only to AGENT_ACTION_COMPLETE - it handles all action types including move
    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      this.boundHandleActionComplete,
    );
  }

  /**
   * Initializes all AI subsystems with current dependencies.
   * Called after constructor and when dependencies change.
   */
  private initializeSubsystems(): void {
    this.stateManager = new AIStateManager(
      this.gameState,
      this.aiStates,
      this.playerControlledAgents,
      this.agentPriorities,
      this.agentStrategies,
    );

    this.goalValidator = new AIGoalValidator({
      gameState: this.gameState,
      worldResourceSystem: this.worldResourceSystem,
      needsSystem: this.needsSystem,
      animalSystem: this.animalSystem,
      getAgentPosition: (agentId: string) => this.getAgentPosition(agentId),
    });

    this.actionPlanner = new AIActionPlanner({
      gameState: this.gameState,
      getAgentPosition: (agentId: string) => this.getAgentPosition(agentId),
      findNearestResource: (entityId: string, resourceType: string) =>
        this.findNearestResourceForEntity(entityId, resourceType),
      findNearestHuntableAnimal: (entityId: string) =>
        this.findNearestHuntableAnimal(entityId),
    });

    this.actionExecutor = new AIActionExecutor({
      gameState: this.gameState,
      needsSystem: this.needsSystem,
      inventorySystem: this.inventorySystem,
      socialSystem: this.socialSystem,
      craftingSystem: this.craftingSystem,
      worldResourceSystem: this.worldResourceSystem,
      taskSystem: this.taskSystem,
      movementSystem: this._movementSystem,
      tryDepositResources: (entityId: string, zoneId: string) =>
        this.tryDepositResources(entityId, zoneId),
    });

    this.urgentGoals = new AIUrgentGoals({
      gameState: this.gameState,
      getAgentPosition: (agentId: string) => this.getAgentPosition(agentId),
      findNearestResourceForEntity: (entityId: string, resourceType: string) =>
        this.findNearestResourceForEntity(entityId, resourceType),
    });

    this.zoneHandler = new AIZoneHandler({
      gameState: this.gameState,
      inventorySystem: this.inventorySystem
        ? {
            getAgentInventory: (agentId: string) => {
              const inv = this.inventorySystem!.getAgentInventory(agentId);
              return inv
                ? {
                    wood: inv.wood,
                    stone: inv.stone,
                    food: inv.food,
                    water: inv.water,
                  }
                : null;
            },
            removeFromAgent: (
              agentId: string,
              type: ResourceType,
              amount: number,
            ) => this.inventorySystem!.removeFromAgent(agentId, type, amount),
            addResource: (
              agentId: string,
              type: ResourceType,
              amount: number,
            ) => this.inventorySystem!.addResource(agentId, type, amount),
            getStockpilesInZone: (zoneId: string) =>
              this.inventorySystem!.getStockpilesInZone(zoneId),
            createStockpile: (zoneId: string, type: string) =>
              this.inventorySystem!.createStockpile(
                zoneId,
                type as StockpileType,
              ),
            transferToStockpile: (
              agentId: string,
              stockpileId: string,
              resources: {
                wood: number;
                stone: number;
                food: number;
                water: number;
              },
            ) =>
              this.inventorySystem!.transferToStockpile(
                agentId,
                stockpileId,
                resources,
              ),
          }
        : null,
      craftingSystem: this.craftingSystem
        ? {
            craftBestWeapon: (agentId: string) =>
              this.craftingSystem!.craftBestWeapon(agentId),
          }
        : null,
      questSystem: this.questSystem
        ? {
            startQuest: (questId: string) =>
              this.questSystem!.startQuest(questId),
          }
        : null,
      roleSystem: this.roleSystem
        ? {
            getAgentRole: (agentId: string) => {
              const role = this.roleSystem!.getAgentRole(agentId);
              return role ? { roleType: role.roleType } : null;
            },
          }
        : null,
      socialSystem: this.socialSystem
        ? {
            registerFriendlyInteraction: (agentId: string, targetId: string) =>
              this.socialSystem!.registerFriendlyInteraction(agentId, targetId),
            imposeLocalTruces: (
              agentId: string,
              radius: number,
              duration: number,
            ) =>
              this.socialSystem!.imposeLocalTruces(agentId, radius, duration),
          }
        : null,
      householdSystem: this.householdSystem
        ? {
            findHouseholdForAgent: (agentId: string) => {
              const household =
                this.householdSystem!.findHouseholdForAgent(agentId);
              return household ? { zoneId: household.zoneId } : null;
            },
          }
        : null,
      needsSystem: this.needsSystem
        ? {
            getNeeds: (entityId: string) => {
              const needs = this.needsSystem!.getNeeds(entityId);
              return needs
                ? {
                    hunger: needs.hunger,
                    thirst: needs.thirst,
                    energy: needs.energy,
                    social: needs.social,
                    fun: needs.fun,
                  }
                : null;
            },
          }
        : null,
      goalsCompletedRef: this._goalsCompletedRef,
    });
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

    this.initializeSubsystems();
  }

  /**
   * Initializes the AI system.
   * Creates AI states for all existing agents in the game state.
   */
  public initialize(): void {
    logger.info("🧠 Initializing AISystem...");
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
      `🧠 AISystem initialized with ${count} new agent states (total: ${this.aiStates.size})`,
    );
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

      if (agent.isDead) continue;

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
    const now = Date.now();
    for (const [key, value] of this.nearestResourceCache.entries()) {
      if (now - value.timestamp > this.RESOURCE_CACHE_TTL) {
        this.nearestResourceCache.delete(key);
      }
    }
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

    // Pre-plan goals to fill queue (up to 3 goals ahead)
    const MAX_QUEUED_GOALS = 3;
    if (aiState.goalQueue.length < MAX_QUEUED_GOALS) {
      this.prePlanGoals(agentId, aiState, now, MAX_QUEUED_GOALS);
    }

    if (!aiState.currentGoal) {
      // Try to get goal from queue first
      if (aiState.goalQueue.length > 0) {
        aiState.currentGoal = aiState.goalQueue.shift() ?? null;
        aiState.lastDecisionTime = now;
        if (aiState.currentGoal) {
          logger.debug(
            `🎯 [AI] ${agentId}: ${describeGoal(aiState.currentGoal)} (from queue)`,
          );
          simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
            agentId,
            newGoal: aiState.currentGoal,
            timestamp: now,
          });
        }
      }

      // If still no goal, make a new decision
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
        performanceMonitor.recordOperation("ai_decision", duration, 1, 0);

        if (newGoal) {
          aiState.currentGoal = newGoal;
          aiState.lastDecisionTime = now;
          logger.debug(`🎯 [AI] ${agentId}: ${describeGoal(newGoal)}`);
          simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
            agentId,
            newGoal,
            timestamp: now,
          });
        } else {
          this.maybeFallbackExplore(agentId, aiState);
        }
      }
    }

    if (aiState.currentGoal) {
      if (this.goalValidator.isGoalInvalid(aiState.currentGoal, agentId)) {
        logger.debug(
          `⚠️ [AI] Agent ${agentId} goal invalidated before action execution`,
        );
        aiState.currentGoal = null;
        aiState.currentAction = null;
        return;
      }

      // Skip if already has an action in progress
      if (aiState.currentAction) {
        return;
      }
      
      // Skip if agent is moving - wait until they arrive
      const isMoving = this._movementSystem?.isMoving(agentId);
      if (isMoving) {
        // Log every 5 seconds approximately (random to avoid spam)
        if (Math.random() < 0.02) {
          logger.debug(`⏳ [AI] ${agentId}: waiting for movement to complete`);
        }
        return;
      }

      // Debug: log the current goal and position
      if (aiState.currentGoal) {
        const agentPos = this.getAgentPosition(agentId);
        const goalPos = aiState.currentGoal.targetPosition;
        if (agentPos && goalPos) {
          const dist = Math.hypot(agentPos.x - goalPos.x, agentPos.y - goalPos.y);
          logger.debug(
            `🎯 [AI] ${agentId}: goal=${aiState.currentGoal.type} target=${aiState.currentGoal.targetId ?? "none"} dist=${dist.toFixed(0)}`,
          );
        }
      }

      const action = this.planAction(agentId, aiState.currentGoal);
      
      // Log when we plan a non-MOVE action (like HARVEST)
      if (action && action.actionType !== "move") {
        logger.debug(
          `🔧 [AI] ${agentId}: Planning ${action.actionType} action`,
        );
      }
      if (action) {
        if (action.targetId) {
          const targetEntity = this.gameState.entities?.find(
            (e) => e.id === action.targetId,
          );
          const targetAgent = this.gameState.agents?.find(
            (a) => a.id === action.targetId,
          );
          if (
            (targetEntity && targetEntity.isDead) ||
            (targetAgent && targetAgent.isDead)
          ) {
            logger.debug(
              `⚠️ [AI] Agent ${agentId} action target ${action.targetId} is dead, abandoning`,
            );
            aiState.currentGoal = null;
            aiState.currentAction = null;
            return;
          }
        }

        aiState.currentAction = action;

        logger.debug(`🏃 [AI] ${agentId}: ${describeAction(action)}`);
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
    let targetX = pos.x + Math.cos(angle) * radius;
    let targetY = pos.y + Math.sin(angle) * radius;
    const mapWidth = this.gameState.worldSize?.width || 2000;
    const mapHeight = this.gameState.worldSize?.height || 2000;
    targetX = Math.max(50, Math.min(mapWidth - 50, targetX));
    targetY = Math.max(50, Math.min(mapHeight - 50, targetY));

    this._movementSystem.moveToPoint(agentId, targetX, targetY);
    logger.debug(`🚶 [AI] Fallback explore triggered for ${agentId}`);
  }

  /**
   * Pre-plans goals to fill the goal queue for smoother transitions.
   * Generates low-priority goals ahead of time so agents have tasks ready.
   *
   * @param agentId - Agent identifier
   * @param aiState - Agent's AI state
   * @param now - Current timestamp
   * @param maxGoals - Maximum goals to keep in queue
   */
  private prePlanGoals(
    agentId: string,
    aiState: AIState,
    now: number,
    maxGoals: number,
  ): void {
    // Don't pre-plan if agent has urgent needs or is in combat
    if (aiState.isInCombat) return;

    const needs = this.needsSystem?.getNeeds(agentId);
    if (
      needs &&
      (needs.hunger < 40 || needs.thirst < 40 || needs.energy < 30)
    ) {
      return; // Agent needs to address urgent needs first
    }

    // Collect already-targeted resources
    const excludedIds = new Set<string>();
    if (aiState.currentGoal?.targetId) {
      excludedIds.add(aiState.currentGoal.targetId);
    }
    for (const g of aiState.goalQueue) {
      if (g.targetId) excludedIds.add(g.targetId);
    }

    // Add work/gather goals to the queue
    let attempts = 0;
    while (aiState.goalQueue.length < maxGoals && attempts < 10) {
      attempts++;
      const workGoal = this.generateWorkGoal(
        agentId,
        aiState,
        now,
        excludedIds,
      );
      if (workGoal && workGoal.targetId) {
        aiState.goalQueue.push(workGoal);
        excludedIds.add(workGoal.targetId); // Prevent same target in next iteration
      } else {
        break; // No more unique work goals available
      }
    }
  }

  /**
   * Generates a work goal based on agent's role and colony needs.
   * @param excludeTargetIds - Resource IDs to exclude (already in queue)
   */
  private generateWorkGoal(
    agentId: string,
    aiState: AIState,
    now: number,
    excludeTargetIds: Set<string> = new Set(),
  ): AIGoal | null {
    const agentRole = this.roleSystem?.getAgentRole(agentId);
    const role = agentRole?.roleType;
    const foodTypes = ["berry_bush", "mushroom_patch", "wheat_crop"];
    const woodTypes = ["tree"];
    const stoneTypes = ["rock"];

    // Collect all already-targeted resources (current goal + queue)
    const excluded = new Set(excludeTargetIds);
    if (aiState.currentGoal?.targetId) {
      excluded.add(aiState.currentGoal.targetId);
    }
    for (const g of aiState.goalQueue) {
      if (g.targetId) excluded.add(g.targetId);
    }

    // Hunters prioritize hunting
    if (role === "hunter") {
      // Find nearest huntable animal
      const animal = this.findNearestHuntableAnimal(agentId);
      logger.debug(
        `🐺 [AI] ${agentId}: hunter findNearestHuntableAnimal -> ${animal?.id ?? "none"} (type: ${animal?.type ?? "N/A"})`,
      );
      if (animal && !excluded.has(animal.id)) {
        logger.debug(
          `🎯 [AI] ${agentId}: Creating HUNT goal for ${animal.id}`,
        );
        return {
          id: `hunt_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
          type: "hunt" as GoalType,
          priority: 0.6,
          targetId: animal.id,
          targetPosition: { x: animal.x, y: animal.y },
          data: {
            taskType: "hunt",
            animalType: animal.type,
          },
          createdAt: now,
        };
      } else if (animal) {
        logger.debug(
          `⚠️ [AI] ${agentId}: Animal ${animal.id} already excluded`,
        );
      }
      // Fallback to gathering food if no animals nearby
      for (const foodType of foodTypes) {
        const resource = this.findNearestResourceForEntity(agentId, foodType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.5,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_food",
              resourceType: "food" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
    }

    // Loggers (Leñadores) gather wood
    if (role === "logger") {
      for (const woodType of woodTypes) {
        const resource = this.findNearestResourceForEntity(agentId, woodType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.6,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_wood",
              resourceType: "wood" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
    }

    // Quarrymen (Canteros) gather stone
    if (role === "quarryman") {
      for (const stoneType of stoneTypes) {
        const resource = this.findNearestResourceForEntity(agentId, stoneType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.6,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_stone",
              resourceType: "stone" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
    }

    // Gatherers focus on food
    if (role === "gatherer") {
      for (const foodType of foodTypes) {
        const resource = this.findNearestResourceForEntity(agentId, foodType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.5,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_food",
              resourceType: "food" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
    }

    // Builders gather wood/stone
    if (role === "builder") {
      for (const woodType of woodTypes) {
        const resource = this.findNearestResourceForEntity(agentId, woodType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.5,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_wood",
              resourceType: "wood" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
      for (const stoneType of stoneTypes) {
        const resource = this.findNearestResourceForEntity(agentId, stoneType);
        if (resource && !excluded.has(resource.id)) {
          return {
            id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: "work" as GoalType,
            priority: 0.5,
            targetId: resource.id,
            targetPosition: { x: resource.x, y: resource.y },
            data: {
              taskType: "gather_stone",
              resourceType: "stone" as ResourceType,
            },
            createdAt: now,
          };
        }
      }
    }

    // Default: gather food (everyone needs to eat)
    for (const foodType of foodTypes) {
      const resource = this.findNearestResourceForEntity(agentId, foodType);
      if (resource && !excluded.has(resource.id)) {
        return {
          id: `work_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
          type: "work" as GoalType,
          priority: 0.4,
          targetId: resource.id,
          targetPosition: { x: resource.x, y: resource.y },
          data: {
            taskType: "gather_food",
            resourceType: "food" as ResourceType,
          },
          createdAt: now,
        };
      }
    }

    return null;
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
    performanceMonitor.recordOperation("ai_process_goals", d0, 1, 0);

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

    const mapWidth = this.gameState.worldSize?.width || 2000;
    const mapHeight = this.gameState.worldSize?.height || 2000;
    let targetX = pos.x + (Math.random() - 0.5) * this.EXPLORE_RANGE;
    let targetY = pos.y + (Math.random() - 0.5) * this.EXPLORE_RANGE;
    targetX = Math.max(50, Math.min(mapWidth - 50, targetX));
    targetY = Math.max(50, Math.min(mapHeight - 50, targetY));

    return {
      id: `explore-${agentId}-${Date.now()}`,
      type: GoalType.EXPLORE,
      priority: 0.5,
      targetPosition: {
        x: targetX,
        y: targetY,
      },
      createdAt: getFrameTime(),
    };
  }

  private processGoals(
    agentId: string,
    aiState: AIState,
    now: number,
  ): AIGoal | null {
    const needs = this.needsSystem?.getNeeds(agentId);
    if (needs) {
      if (needs.hunger < 20) {
        const foodGoal = this.createUrgentFoodGoal(agentId, now);
        if (foodGoal) return foodGoal;
      }
      if (needs.thirst < 20) {
        const waterGoal = this.createUrgentWaterGoal(agentId, now);
        if (waterGoal) return waterGoal;
      }
      if (needs.energy < 15) {
        const restGoal = this.createUrgentRestGoal(agentId, now);
        if (restGoal) return restGoal;
      }
      if (needs.social < 20) {
        const socialGoal = this.createUrgentSocialGoal(agentId, now);
        if (socialGoal) return socialGoal;
      }
      if (needs.fun < 15) {
        const funGoal = this.createUrgentFunGoal(agentId, now);
        if (funGoal) return funGoal;
      }
    }

    const deps: AgentGoalPlannerDeps = {
      gameState: this.gameState,
      priorityManager: this.priorityManager,
      getEntityNeeds: (id: string) => this.needsSystem?.getNeeds(id),
      findNearestResource: (id: string, resourceType: string) => {
        return this.findNearestResourceForEntity(id, resourceType);
      },
      findNearestHuntableAnimal: (entityId: string) =>
        this.findNearestHuntableAnimal(entityId),
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
            z.bounds &&
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
        const zone = this.gameState.zones?.find(
          (z) => z.type === ZoneType.WORK || z.type === ZoneType.STORAGE,
        );
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
      taskSystem: this.taskSystem
        ? {
            createTask: (params: TaskCreationParams) =>
              this.taskSystem!.createTask(params),
            getAvailableCommunityTasks: () =>
              this.taskSystem!.getAvailableCommunityTasks(),
            claimTask: (taskId: string, agentId: string) =>
              this.taskSystem!.claimTask(taskId, agentId),
            releaseTaskClaim: (taskId: string, agentId: string) =>
              this.taskSystem!.releaseTaskClaim(taskId, agentId),
          }
        : undefined,
      sharedKnowledgeSystem: this.sharedKnowledgeSystem
        ? {
            getKnownResourceAlerts: (agentId: string): ResourceAlert[] => {
              if (!this.sharedKnowledgeSystem) return [];
              return this.sharedKnowledgeSystem.getKnownResourceAlerts(agentId);
            },
            getKnownThreatAlerts: (agentId: string): ThreatAlert[] => {
              if (!this.sharedKnowledgeSystem) return [];
              return this.sharedKnowledgeSystem.getKnownThreatAlerts(agentId);
            },
          }
        : undefined,
      getActiveQuests: () => this.questSystem?.getActiveQuests() || [],
      getAvailableQuests: () => this.questSystem?.getAvailableQuests() || [],
      getCurrentTimeOfDay: () => {
        return (this.timeSystem?.getCurrentTime().phase ||
          "morning") as TimeOfDay["phase"];
      },
      getEntityPosition: (id: string) => this.getAgentPosition(id) || null,
      getNearbyAgentsWithDistances: (entityId: string, radius: number) =>
        this.getNearbyAgentsWithDistancesGPU(entityId, radius),

      getAllStockpiles: () => this.inventorySystem?.getAllStockpiles() || [],
      getActiveDemands: () => {
        const governance = this.gameState.governance;
        if (!governance || !governance.demands) return [];
        return governance.demands.filter(
          (d: { resolvedAt?: number }) => !d.resolvedAt,
        );
      },
      getPopulation: () => {
        return this.gameState.agents?.filter((a) => !a.isDead).length || 0;
      },
      getCollectiveResourceState: () => {
        const stockpiles = this.inventorySystem?.getAllStockpiles() || [];
        const population =
          this.gameState.agents?.filter((a) => !a.isDead).length || 1;

        let totalFood = 0;
        let totalWater = 0;
        let totalCapacity = 0;
        let usedCapacity = 0;

        for (const sp of stockpiles) {
          totalFood += sp.inventory.food || 0;
          totalWater += sp.inventory.water || 0;
          totalCapacity += sp.capacity;
          usedCapacity +=
            (sp.inventory.food || 0) +
            (sp.inventory.water || 0) +
            (sp.inventory.wood || 0) +
            (sp.inventory.stone || 0);
        }

        return {
          foodPerCapita: totalFood / Math.max(1, population),
          waterPerCapita: totalWater / Math.max(1, population),
          stockpileFillRatio:
            totalCapacity > 0 ? usedCapacity / totalCapacity : 0,
        };
      },
      findAgentWithResource: (
        entityId: string,
        resourceType: "food" | "water",
        minAmount: number,
      ) => this.findAgentWithResource(entityId, resourceType, minAmount),
      findPotentialMate: (entityId: string) => this.findPotentialMate(entityId),
      findNearbyAgent: (entityId: string) => this.findNearbyAgent(entityId),
    };

    const goals = planGoals(deps, aiState, now);
    return goals.length > 0 ? goals[0] : null;
  }

  private createAIState(agentId: string): AIState {
    return this.stateManager.createAIState(agentId);
  }

  /**
   * Create urgent food goal when hunger is critical
   */
  private createUrgentFoodGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentFoodGoal(agentId, now);
  }

  /**
   * Create urgent water goal when thirst is critical
   */
  private createUrgentWaterGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentWaterGoal(agentId, now);
  }

  /**
   * Create urgent rest goal when energy is critical
   * Rest has slightly lower effective priority than hunger/thirst since
   * agents can idle in place to rest if no zone is available
   */
  private createUrgentRestGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentRestGoal(agentId, now);
  }

  /**
   * Create urgent social goal when social need is critical
   * Social needs are less critical than survival needs, priority 9
   */
  private createUrgentSocialGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentSocialGoal(agentId, now);
  }

  /**
   * Create urgent fun goal when fun need is critical
   * Fun needs are least critical, priority 8
   */
  private createUrgentFunGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentFunGoal(agentId, now);
  }

  /**
   * Notifies the AI system that an entity has arrived at a zone.
   * Delegates to AIZoneHandler for goal completion and zone-specific actions.
   *
   * @param entityId - Entity identifier
   * @param zoneId - Zone identifier where entity arrived
   */
  public notifyEntityArrived(entityId: string, zoneId?: string): void {
    const aiState = this.aiStates.get(entityId);
    if (!aiState) return;

    this.zoneHandler.notifyEntityArrived(entityId, zoneId, aiState);
  }

  private tryDepositResources(entityId: string, zoneId: string): void {
    this.zoneHandler.tryDepositResources(entityId, zoneId);
  }

  /**
   * Cleans up agent memory by delegating to state manager.
   * @param now - Current timestamp
   */
  private cleanupAgentMemory(now: number): void {
    this.stateManager.cleanupAgentMemory(now);
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
      if (
        this._movementSystem &&
        typeof this._movementSystem.stopMovement === "function"
      ) {
        this._movementSystem.stopMovement(entityId);
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
      goalsCompleted: this.goalValidator.goalsCompleted,
      goalsFailed: this.goalValidator.goalsFailed,
    };
  }

  /**
   * Removes AI state for an entity.
   * Delegates to AIStateManager.
   *
   * @param entityId - Entity identifier to remove
   */
  public removeEntityAI(entityId: string): void {
    this.stateManager.removeEntityAI(entityId);
    this.activeAgentIdsCache = null; // Invalidate cache
  }

  /**
   * Cleans up all AI states and removes all event listeners.
   */
  public cleanup(): void {
    this.aiStates.clear();
    this.agentPriorities.clear();
    this.agentStrategies.clear();
    this.playerControlledAgents.clear();
    this.activeAgentIdsCache = null;
    this.zoneCache.clear();
    this.craftingZoneCache = null;
    this.nearestResourceCache.clear();
    this._goalsCompletedRef.value = 0;
    this.goalValidator.resetMetrics();
    this._decisionCount = 0;
    this._decisionTimeTotalMs = 0;
    simulationEvents.off(
      GameEventNames.AGENT_ACTION_COMPLETE,
      this.boundHandleActionComplete,
    );
    this.removeAllListeners();
  }

  private isGoalCompleted(goal: AIGoal, agentId: string): boolean {
    return this.goalValidator.isGoalCompleted(goal, agentId);
  }

  private isGoalInvalid(goal: AIGoal, agentId: string): boolean {
    return this.goalValidator.isGoalInvalid(goal, agentId);
  }

  private completeGoal(aiState: AIState, agentId: string): void {
    // Release resource reservation when goal completes
    this.releaseResourceReservation(agentId);

    // Check if there's a queued goal to process next
    if (aiState.goalQueue.length > 0) {
      aiState.currentGoal = aiState.goalQueue.shift() ?? null;
      aiState.currentAction = null;
      aiState.lastDecisionTime = Date.now();
      this._goalsCompletedRef.value++;
    } else {
      this.goalValidator.completeGoal(aiState);
    }
  }

  private failGoal(aiState: AIState, agentId: string): void {
    // Record failed target in memory to avoid immediate retry
    const targetId = aiState.currentGoal?.targetId;
    if (targetId) {
      if (!aiState.memory.failedTargets) {
        aiState.memory.failedTargets = new Map<string, number>();
      }
      aiState.memory.failedTargets.set(targetId, Date.now());
      // Clean old entries (keep last 20)
      if (aiState.memory.failedTargets.size > 20) {
        const entries = [...aiState.memory.failedTargets.entries()];
        entries.sort((a, b) => a[1] - b[1]);
        for (let i = 0; i < entries.length - 20; i++) {
          aiState.memory.failedTargets.delete(entries[i][0]);
        }
      }
    }

    // Release resource reservation when goal fails
    this.releaseResourceReservation(agentId);
    this.goalValidator.failGoal(aiState);
  }

  private planAction(agentId: string, goal: AIGoal): AgentAction | null {
    return this.actionPlanner.planAction(agentId, goal);
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
    let state = this.aiStates.get(agentId);
    if (!state) {
      const agent = this.gameState.agents?.find((a) => a.id === agentId);
      if (agent) {
        state = this.createAIState(agentId);
        this.aiStates.set(agentId, state);
      }
    }
    return state;
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
   * Delegates to AIStateManager with movement stop callback.
   *
   * @param agentId - Agent identifier
   * @param offDuty - Whether the agent is off-duty
   */
  public setAgentOffDuty(agentId: string, offDuty: boolean): void {
    const stopMovement =
      this._movementSystem &&
      typeof this._movementSystem.stopMovement === "function"
        ? (id: string) => this._movementSystem!.stopMovement(id)
        : undefined;
    this.stateManager.setAgentOffDuty(agentId, offDuty, stopMovement);
  }

  /**
   * Forces goal reevaluation for an agent on the next update.
   * Delegates to AIStateManager.
   *
   * @param agentId - Agent identifier
   */
  public forceGoalReevaluation(agentId: string): void {
    this.stateManager.forceGoalReevaluation(agentId);
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
    const cacheKey = `${entityId}_${resourceType}`;
    const cached = this.nearestResourceCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.RESOURCE_CACHE_TTL) {
      // Check if our cached resource is still reserved by us
      const reservedBy = this.resourceReservations.get(
        cached.resource?.id ?? "",
      );
      if (cached.resource && reservedBy === entityId) {
        return cached.resource;
      }
    }

    const agent =
      this.entityIndex?.getAgent(entityId) ??
      this.gameState.agents?.find((a) => a.id === entityId);
    if (!agent?.position) return null;

    const maxRadiusSq =
      this.MAX_RESOURCE_SEARCH_RADIUS * this.MAX_RESOURCE_SEARCH_RADIUS;
    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = maxRadiusSq; // Start with max radius as threshold

    // Harvestable states: pristine and harvested_partial still have resources
    const harvestableStates = ["pristine", "harvested_partial"];

    if (this.worldResourceSystem) {
      const resources = this.worldResourceSystem.getResourcesByType(
        resourceType as WorldResourceType,
      );

      for (const resource of resources) {
        if (!harvestableStates.includes(resource.state)) continue;

        // Skip resources already reserved by other agents
        const reservedBy = this.resourceReservations.get(resource.id);
        if (reservedBy && reservedBy !== entityId) continue;

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
    } else if (this.gameState.worldResources) {
      for (const resource of Object.values(this.gameState.worldResources)) {
        if (
          resource.type !== resourceType ||
          !harvestableStates.includes(resource.state)
        )
          continue;

        // Skip resources already reserved by other agents
        const reservedBy = this.resourceReservations.get(resource.id);
        if (reservedBy && reservedBy !== entityId) continue;

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

    // Reserve the resource for this agent
    if (nearest) {
      // Release any previous reservation by this agent
      for (const [resId, agentId] of this.resourceReservations) {
        if (agentId === entityId && resId !== nearest.id) {
          this.resourceReservations.delete(resId);
        }
      }
      this.resourceReservations.set(nearest.id, entityId);
    }

    this.nearestResourceCache.set(cacheKey, {
      resource: nearest,
      timestamp: now,
    });
    return nearest;
  }

  private findAgentWithResource(
    entityId: string,
    resourceType: "food" | "water",
    minAmount: number,
  ): { agentId: string; x: number; y: number } | null {
    const agent = this.gameState.agents.find((a) => a.id === entityId);
    if (!agent?.position) return null;

    let nearest: { agentId: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    for (const other of this.gameState.agents) {
      if (other.id === entityId || other.isDead) continue;
      if (!other.position) continue;

      const inventory = this.inventorySystem?.getAgentInventory(other.id);
      if (!inventory) continue;

      const amount = inventory[resourceType] || 0;
      if (amount >= minAmount) {
        const dx = other.position.x - agent.position.x;
        const dy = other.position.y - agent.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistance) {
          minDistance = distSq;
          nearest = {
            agentId: other.id,
            x: other.position.x,
            y: other.position.y,
          };
        }
      }
    }
    return nearest;
  }

  private findPotentialMate(
    entityId: string,
  ): { id: string; x: number; y: number } | null {
    const agent = this.gameState.agents.find((a) => a.id === entityId);
    if (!agent?.position) return null;

    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    for (const other of this.gameState.agents) {
      if (other.id === entityId || other.isDead) continue;
      if (!other.position) continue;

      // Basic check: opposite sex and adult
      if (agent.sex && other.sex && agent.sex !== other.sex) {
        if (other.ageYears >= 18) {
          const dx = other.position.x - agent.position.x;
          const dy = other.position.y - agent.position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDistance) {
            minDistance = distSq;
            nearest = {
              id: other.id,
              x: other.position.x,
              y: other.position.y,
            };
          }
        }
      }
    }
    return nearest;
  }

  private findNearbyAgent(
    entityId: string,
  ): { id: string; x: number; y: number } | null {
    const agent = this.gameState.agents.find((a) => a.id === entityId);
    if (!agent?.position) return null;

    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    for (const other of this.gameState.agents) {
      if (other.id === entityId || other.isDead) continue;
      if (!other.position) continue;

      const dx = other.position.x - agent.position.x;
      const dy = other.position.y - agent.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistance) {
        minDistance = distSq;
        nearest = {
          id: other.id,
          x: other.position.x,
          y: other.position.y,
        };
      }
    }
    return nearest;
  }

  /**
   * Releases resource reservation when goal completes or fails.
   */
  private releaseResourceReservation(agentId: string): void {
    for (const [resId, reservedBy] of this.resourceReservations) {
      if (reservedBy === agentId) {
        this.resourceReservations.delete(resId);
      }
    }
  }

  /**
   * Finds the nearest huntable animal for an agent.
   * Uses AnimalSystem directly for real-time animal data.
   */
  private findNearestHuntableAnimal(
    entityId: string,
  ): { id: string; x: number; y: number; type: string } | null {
    const agentPos = this.getAgentPosition(entityId);
    if (!agentPos) return null;

    // Use AnimalSystem directly - this is the source of truth for animals
    if (!this.animalSystem) {
      logger.debug(`🐺 [AI] ${entityId}: animalSystem not available`);
      return null;
    }

    const HUNT_SEARCH_RANGE = 800;
    const animals = this.animalSystem.getAnimalsInRadius(
      agentPos,
      HUNT_SEARCH_RANGE,
    );

    if (animals.length === 0) {
      logger.debug(
        `🐺 [AI] ${entityId}: No animals in radius ${HUNT_SEARCH_RANGE} (agentPos: ${Math.round(agentPos.x)},${Math.round(agentPos.y)})`,
      );
      return null;
    }

    let nearest: { id: string; x: number; y: number; type: string } | null =
      null;
    let minDist = Infinity;

    for (const animal of animals) {
      if (animal.isDead) continue;
      const config = getAnimalConfig(animal.type);
      if (!config?.canBeHunted) continue;

      const dist = Math.hypot(
        agentPos.x - animal.position.x,
        agentPos.y - animal.position.y,
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = {
          id: animal.id,
          x: animal.position.x,
          y: animal.position.y,
          type: animal.type,
        };
      }
    }

    if (nearest) {
      logger.debug(
        `🐺 [AI] ${entityId}: Found huntable ${nearest.type} at dist ${minDist.toFixed(0)}`,
      );
    }

    return nearest;
  }

  /**
   * GPU-accelerated search for nearby agents within a radius.
   * Uses pairwise distance computation on GPU when there are many agents.
   *
   * @param entityId - The entity to search from
   * @param radius - Search radius
   * @returns Array of nearby agents with their distances, sorted by distance
   */
  private getNearbyAgentsWithDistancesGPU(
    entityId: string,
    radius: number,
  ): Array<{ id: string; distance: number }> {
    const myAgent =
      this.entityIndex?.getAgent(entityId) ??
      this.gameState.agents?.find((a) => a.id === entityId);
    if (!myAgent?.position) return [];

    const activeAgents = this.gameState.agents.filter(
      (a) => !a.isDead && a.id !== entityId && a.position,
    );

    if (activeAgents.length === 0) return [];

    const GPU_THRESHOLD = 30; // Use GPU when checking 30+ agents
    const radiusSq = radius * radius;

    if (
      this.gpuService?.isGPUAvailable() &&
      activeAgents.length >= GPU_THRESHOLD
    ) {
      const positions = new Float32Array(activeAgents.length * 2);

      for (let i = 0; i < activeAgents.length; i++) {
        const agent = activeAgents[i];
        positions[i * 2] = agent.position!.x;
        positions[i * 2 + 1] = agent.position!.y;
      }

      const distancesSq = this.gpuService.computeDistancesBatch(
        myAgent.position.x,
        myAgent.position.y,
        positions,
      );

      const nearby: Array<{ id: string; distance: number }> = [];
      for (let i = 0; i < activeAgents.length; i++) {
        const distSq = distancesSq[i];
        if (distSq <= radiusSq) {
          nearby.push({
            id: activeAgents[i].id,
            distance: Math.sqrt(distSq),
          });
        }
      }

      nearby.sort((a, b) => a.distance - b.distance);
      return nearby;
    }

    const nearby: Array<{ id: string; distance: number }> = [];

    for (const agent of activeAgents) {
      const dx = agent.position!.x - myAgent.position.x;
      const dy = agent.position!.y - myAgent.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        nearby.push({
          id: agent.id,
          distance: Math.sqrt(distSq),
        });
      }
    }

    nearby.sort((a, b) => a.distance - b.distance);
    return nearby;
  }

  private handleActionComplete(payload: {
    agentId: string;
    success: boolean;
    actionType?: string;
    data?: Record<string, unknown>;
  }): void {
    const aiState = this.aiStates.get(payload.agentId);
    if (!aiState) return;
    
    // Ignore movement complete events if we didn't have a move action
    // (e.g., idle wander from MovementSystem)
    if (payload.actionType === "move" && aiState.currentAction?.actionType !== "move") {
      return;
    }
    
    const prevAction = aiState.currentAction?.actionType;
    aiState.currentAction = null;

    if (!payload.success) {
      this.failGoal(aiState, payload.agentId);
      return;
    }

    // Don't complete goal on MOVE actions - the agent just arrived somewhere
    // The goal should only complete when the actual work is done (harvest, eat, etc.)
    if (payload.actionType === "move") {
      // Agent arrived at destination, next tick will plan the actual action
      logger.debug(
        `📍 [AI] ${payload.agentId}: arrived (prev=${prevAction ?? "none"}), ready for harvest`,
      );
      return;
    }

    // Harvest/Attack actions complete the goal immediately when successful
    if (payload.actionType === "harvest" || payload.actionType === "attack") {
      this.completeGoal(aiState, payload.agentId);
      return;
    }

    // For work tasks, check if task is actually completed
    if (
      payload.actionType === "work" &&
      payload.data &&
      typeof payload.data.taskId === "string"
    ) {
      const task = this.taskSystem?.getTask(payload.data.taskId);
      if (task && !task.completed) {
        return;
      }
    }

    // For satisfy_* goals, check if the need is actually satisfied
    if (aiState.currentGoal) {
      const goalType = aiState.currentGoal.type;

      if (goalType.startsWith("satisfy_")) {
        const needType = aiState.currentGoal.data?.need as string;
        if (needType && this.needsSystem) {
          const needs = this.needsSystem.getNeeds(payload.agentId);
          if (needs) {
            const needValue = needs[needType as keyof typeof needs] as number;
            // Only complete if need is reasonably satisfied (> 50)
            if (needValue <= 50) {
              return; // Need not satisfied yet, keep the goal
            }
          }
        }
      }
    }

    this.completeGoal(aiState, payload.agentId);
  }

  private executeAction(action: AgentAction): void {
    this.actionExecutor.executeAction(action);
  }

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
      const goalType = goal.type as GoalType;
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
        expiresAt: Date.now() + 60000,
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
      aiState.currentAction = null;
      aiState.goalQueue = [];
    }
  }

  public getCurrentGoal(agentId: string): unknown {
    const aiState = this.aiStates.get(agentId);
    return aiState?.currentGoal;
  }

  /**
   * Removes all AI state for an agent (on death).
   * This completely removes the agent from AI processing.
   * @param agentId - Agent identifier
   */
  public removeAgentState(agentId: string): void {
    this.removeEntityAI(agentId);
  }
}
