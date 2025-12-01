import { logger } from "../../../../infrastructure/utils/logger";
import { EventEmitter } from "events";
import { GameState } from "@/shared/types/game-types";
import {
  AIGoal,
  AIGoalData,
  AIState,
  AgentAction,
  GoalType,
} from "@/shared/types/simulation/ai";
import { ResourceType } from "../../../../shared/constants/ResourceEnums";
import {
  GoalType as GoalTypeEnum,
  ActionType,
  GoalPrefix,
} from "../../../../shared/constants/AIEnums";
import { RoleType } from "../../../../shared/constants/RoleEnums";
import { AgentPriority } from "../../../../shared/constants/AIEnums";
import { TaskType } from "../../../../shared/constants/TaskEnums";
import { itemToWorldResources } from "@/shared/types/simulation/resourceMapping";
import type { WorldResourceType } from "@/shared/types/simulation/worldResources";
import { StockpileType } from "../../../../shared/constants/ZoneEnums";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";
import { getAnimalConfig } from "../world/config/AnimalConfigs";
import { WeaponId as CraftingWeaponId } from "../../../../shared/constants/CraftingEnums";

import type { Stockpile } from "@/shared/types/simulation/economy";

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
  planGoalsFull,
  type SimplifiedGoalPlannerDeps,
} from "./ai/core/SimplifiedGoalPlanner";
import {
  evaluateCollectiveNeeds,
  type CollectiveNeedsContext,
} from "./ai/evaluators/CollectiveNeedsEvaluator";
import { PriorityManager } from "./ai/core/PriorityManager";
import { AIStateManager } from "./ai/core/AIStateManager";
import { AIGoalValidator } from "./ai/core/AIGoalValidator";
import { SimpleActionPlanner } from "./ai/core/SimpleActionPlanner";
import { AIActionExecutor } from "./ai/core/AIActionExecutor";
import { AIUrgentGoals } from "./ai/core/AIUrgentGoals";
import { AIZoneHandler } from "./ai/core/AIZoneHandler";
import { generateRoleBasedWorkGoal } from "./ai/core/WorkGoalGenerator";
import { EquipmentSystem, equipmentSystem } from "./EquipmentSystem";
import { equipmentSystem as toolStorage } from "./EquipmentSystem";
import { EquipmentSlot } from "../../../../shared/constants/EquipmentEnums";
import { GameEventType } from "../../core/events";
import { simulationEvents } from "../../core/events";
import type { NeedsSystem } from "./needs/NeedsSystem";
import { RoleSystem } from "./RoleSystem";
import type { InventorySystem } from "../economy/InventorySystem";
import type { SharedKnowledgeSystem } from "./ai/SharedKnowledgeSystem";
import type { SocialSystem } from "../social/SocialSystem";
import type { EnhancedCraftingSystem } from "../economy/EnhancedCraftingSystem";
import type { WorldResourceSystem } from "../world/WorldResourceSystem";
import type { HouseholdSystem } from "../social/HouseholdSystem";
import type { TaskSystem } from "../objectives/TaskSystem";
import type { CombatSystem } from "../conflict/CombatSystem";
import type { AnimalSystem } from "../world/animals/AnimalSystem";
import type { MovementSystem } from "./movement/MovementSystem";

import type { TimeSystem } from "../core/TimeSystem";
import type { EntityIndex } from "../../core/EntityIndex";
import type { GPUComputeService } from "../../core/GPUComputeService";
import type { AnimalRegistry } from "../world/animals/AnimalRegistry";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../../core/PerformanceMonitor";
import { getFrameTime } from "../../../../shared/FrameTime";

interface AISystemConfig {
  updateIntervalMs: number;
  enablePersonality: boolean;
  enableMemory: boolean;
  maxMemoryItems: number;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import type { AgentRegistry } from "../agents/AgentRegistry";

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
  // @ts-expect-error Reserved for future use
  private _priorityManager: PriorityManager;

  private stateManager!: AIStateManager;
  private goalValidator!: AIGoalValidator;
  private actionPlanner!: SimpleActionPlanner;
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

  // @ts-expect-error Reserved for future use
  private _timeSystem?: TimeSystem;
  // @ts-expect-error Reserved for future use
  private _sharedKnowledgeSystem?: SharedKnowledgeSystem;
  private equipmentSystem: EquipmentSystem;
  // @ts-expect-error - Reserved for future use
  private _entityIndex?: EntityIndex;
  private gpuService?: GPUComputeService;
  private agentRegistry?: AgentRegistry;
  private animalRegistry?: AnimalRegistry;

  private agentIndex = 0;

  private _lastMemoryCleanupTime = 0;
  private readonly MEMORY_CLEANUP_INTERVAL = 300000;

  /**
   * Batch size for agent processing per update.
   * With updateInterval=250ms, processing 10 agents ensures all agents
   * get updated within 250-500ms for responsive behavior.
   */
  private readonly BATCH_SIZE = 2;

  private zoneCache = new Map<string, string | undefined>();
  private craftingZoneCache: string | undefined | null = null;
  // @ts-expect-error Reserved for future use
  private _activeAgentIdsCache: string[] | null = null;
  private lastCacheInvalidation = 0;
  /**
   * Cache invalidation interval - increased to 2s for better performance.
   * Zones don't change frequently, so stale data is acceptable.
   */
  private readonly CACHE_INVALIDATION_INTERVAL = 2000;

  private nearestResourceCache = new Map<
    string,
    { resource: { id: string; x: number; y: number } | null; timestamp: number }
  >();
  private readonly RESOURCE_CACHE_TTL = 2000;
  private readonly MAX_RESOURCE_SEARCH_RADIUS = 2000;

  private resourceReservations = new Map<string, string>();

  private readonly MAX_DECISION_TIME_MS = 5;

  private readonly EXPLORE_RANGE = 200;

  /**
   * Queue of agents pending re-evaluation after goal timeout.
   * This prevents cascade saturation when multiple goals expire at once.
   */
  private pendingReEvaluations = new Set<string>();
  /**
   * Maximum agents to re-evaluate per tick from the pending queue.
   * This throttles re-evaluations to prevent tick saturation.
   */
  private readonly MAX_REEVALUATIONS_PER_TICK = 1;
  /**
   * Goal expiration jitter range in ms.
   * Goals will have random jitter added to their createdAt to desynchronize expirations.
   */
  private readonly GOAL_JITTER_RANGE_MS = 15000;

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
  private agentPriorities = new Map<string, AgentPriority>();

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

    @inject(TYPES.TimeSystem) @optional() timeSystem?: TimeSystem,
    @inject(TYPES.EntityIndex)
    @optional()
    entityIndex?: EntityIndex,
    @inject(TYPES.GPUComputeService)
    @optional()
    gpuService?: GPUComputeService,
    @inject(TYPES.AgentRegistry)
    @optional()
    agentRegistry?: AgentRegistry,
    @inject(TYPES.AnimalRegistry)
    @optional()
    animalRegistry?: AnimalRegistry,
  ) {
    super();
    this.gameState = gameState;
    this._entityIndex = entityIndex;
    this.gpuService = gpuService;
    this.agentRegistry = agentRegistry;
    this.animalRegistry = animalRegistry;

    this.equipmentSystem = equipmentSystem;
    this.config = {
      updateIntervalMs: 50,
      enablePersonality: true,
      enableMemory: true,
      maxMemoryItems: 50,
    };

    this.aiStates = new Map();

    if (this.agentRegistry) {
      this.agentRegistry.registerAIStates(this.aiStates);
    }

    this._priorityManager = new PriorityManager(
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

    this._timeSystem = timeSystem;

    this.initializeSubsystems();

    this.boundHandleActionComplete = this.handleActionComplete.bind(this);
    simulationEvents.on(
      GameEventType.AGENT_ACTION_COMPLETE,
      this.boundHandleActionComplete,
    );

    simulationEvents.on(
      GameEventType.ROLE_REASSIGNED,
      this.handleRoleReassigned.bind(this),
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
      this.agentRegistry,
    );

    this.goalValidator = new AIGoalValidator({
      gameState: this.gameState,
      worldResourceSystem: this.worldResourceSystem,
      needsSystem: this.needsSystem,
      animalSystem: this.animalSystem,
      agentRegistry: this.agentRegistry!,
    });

    this.actionPlanner = new SimpleActionPlanner({
      gameState: this.gameState,
      agentRegistry: this.agentRegistry!,
      findNearestResource: (
        entityId: string,
        resourceType: string,
      ): { id: string; x: number; y: number } | null =>
        this.findNearestResourceForEntity(entityId, resourceType),
      findNearestHuntableAnimal: (
        entityId: string,
      ): { id: string; x: number; y: number; type: string } | null =>
        this.findNearestHuntableAnimal(entityId),
      getAnimalPosition: (
        animalId: string,
      ): { x: number; y: number } | null => {
        const animal = this.animalSystem?.getAnimal(animalId);
        if (animal && !animal.isDead) {
          return { x: animal.position.x, y: animal.position.y };
        }
        return null;
      },
      getAgentAttackRange: (agentId: string): number => {
        return this.equipmentSystem.getAttackRange(agentId);
      },
      agentHasWeapon: (agentId: string): boolean => {
        const equipped = this.equipmentSystem.getEquippedItem(
          agentId,
          EquipmentSlot.MAIN_HAND,
        );
        return equipped !== undefined;
      },
      tryClaimWeapon: (agentId: string): boolean => {
        const weapon = toolStorage.findToolForRole("hunter");
        if (weapon && toolStorage.claimTool(agentId, weapon)) {
          this.equipmentSystem.equipItem(
            agentId,
            EquipmentSlot.MAIN_HAND,
            weapon,
          );
          return true;
        }
        return false;
      },
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
      tryDepositResources: (entityId: string, zoneId: string): void =>
        this.tryDepositResources(entityId, zoneId),
      agentRegistry: this.agentRegistry,
      animalRegistry: this.animalRegistry,
    });

    this.urgentGoals = new AIUrgentGoals({
      gameState: this.gameState,
      agentRegistry: this.agentRegistry!,
      findNearestResourceForEntity: (
        entityId: string,
        resourceType: string,
      ): { id: string; x: number; y: number } | null =>
        this.findNearestResourceForEntity(entityId, resourceType),
    });

    this.zoneHandler = new AIZoneHandler({
      gameState: this.gameState,
      inventorySystem: this.inventorySystem
        ? {
            getAgentInventory: (
              agentId: string,
            ): {
              wood: number;
              stone: number;
              food: number;
              water: number;
            } | null => {
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
            ): number =>
              this.inventorySystem!.removeFromAgent(agentId, type, amount),
            addResource: (
              agentId: string,
              type: ResourceType,
              amount: number,
            ): boolean =>
              this.inventorySystem!.addResource(agentId, type, amount),
            getStockpilesInZone: (zoneId: string): Stockpile[] =>
              this.inventorySystem!.getStockpilesInZone(zoneId),
            createStockpile: (zoneId: string, type: string): Stockpile =>
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
            ): Record<ResourceType, number> =>
              this.inventorySystem!.transferToStockpile(
                agentId,
                stockpileId,
                resources,
              ),
          }
        : null,
      craftingSystem: this.craftingSystem
        ? {
            craftBestWeapon: (agentId: string): string | null =>
              this.craftingSystem!.craftBestWeapon(agentId),
          }
        : null,

      questSystem: null,
      roleSystem: this.roleSystem
        ? {
            getAgentRole: (agentId: string): { roleType: string } | null => {
              const role = this.roleSystem!.getAgentRole(agentId);
              return role ? { roleType: role.roleType } : null;
            },
          }
        : null,
      socialSystem: this.socialSystem
        ? {
            registerFriendlyInteraction: (
              agentId: string,
              targetId: string,
            ): void =>
              this.socialSystem!.registerFriendlyInteraction(agentId, targetId),
            imposeLocalTruces: (
              agentId: string,
              radius: number,
              duration: number,
            ): void =>
              this.socialSystem!.imposeLocalTruces(agentId, radius, duration),
          }
        : null,
      householdSystem: this.householdSystem
        ? {
            findHouseholdForAgent: (
              agentId: string,
            ): { zoneId: string } | null => {
              const household =
                this.householdSystem!.findHouseholdForAgent(agentId);
              return household ? { zoneId: household.zoneId } : null;
            },
          }
        : null,
      needsSystem: this.needsSystem
        ? {
            getNeeds: (
              entityId: string,
            ): {
              hunger: number;
              thirst: number;
              energy: number;
              social: number;
              fun: number;
            } | null => {
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
      agentRegistry: this.agentRegistry,
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

    if (systems.timeSystem) this._timeSystem = systems.timeSystem;

    this.simplifiedDepsCache = null;

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
   * Syncs internal AI state to GameState for persistence.
   */
  public syncToGameState(): void {
    if (!this.gameState.agents) return;

    for (const agent of this.gameState.agents) {
      const aiState = this.aiStates.get(agent.id);
      if (aiState) {
        agent.ai = {
          currentGoal: aiState.currentGoal,
          goalQueue: aiState.goalQueue,
          currentAction: aiState.currentAction,
          offDuty: aiState.offDuty,
          lastDecisionTime: aiState.lastDecisionTime,
        };
      }
    }
  }

  /**
   * Restores AI state from persisted data.
   */
  public restoreAIState(
    agentId: string,
    savedState: {
      currentGoal: unknown;
      goalQueue: unknown[];
      currentAction: unknown;
      offDuty: boolean;
      lastDecisionTime: number;
    },
  ): void {
    const aiState = this.aiStates.get(agentId) || this.createAIState(agentId);

    aiState.currentGoal = savedState.currentGoal as AIGoal | null;
    aiState.goalQueue = (savedState.goalQueue as AIGoal[]) || [];
    aiState.currentAction = savedState.currentAction as AgentAction | null;
    aiState.offDuty = savedState.offDuty;
    aiState.lastDecisionTime = savedState.lastDecisionTime;

    this.aiStates.set(agentId, aiState);
  }

  /**
   * Updates the AI system, processing agents in batches with yield to avoid blocking event loop.
   * Processes up to 5 agents per update, with micro-batches of 3 agents that yield to event loop.
   * Skips player-controlled agents and agents that are off-duty.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (not used, uses config interval)
   */
  public async update(_deltaTimeMs: number): Promise<void> {
    const now = getFrameTime();

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
        await this.processAgent(agent.id, aiState, now);
      } catch (error) {
        logger.error(`Error processing agent ${agent.id}`, { error });
      }
    }

    this.agentIndex = (this.agentIndex + batchSize) % agents.length;

    await this.processPendingReEvaluations(now);
  }

  /**
   * Processes pending re-evaluations from agents with timed-out goals.
   * Throttled to MAX_REEVALUATIONS_PER_TICK to prevent cascade saturation.
   */
  private async processPendingReEvaluations(now: number): Promise<void> {
    if (this.pendingReEvaluations.size === 0) return;

    let processed = 0;
    for (const agentId of this.pendingReEvaluations) {
      if (processed >= this.MAX_REEVALUATIONS_PER_TICK) break;

      const aiState = this.aiStates.get(agentId);
      if (!aiState || aiState.currentGoal) {
        this.pendingReEvaluations.delete(agentId);
        continue;
      }

      const agent = this.agentRegistry?.getProfile(agentId);
      if (!agent || agent.isDead) {
        this.pendingReEvaluations.delete(agentId);
        continue;
      }

      try {
        const newGoal = await this.makeDecision(agentId, aiState, now);
        if (newGoal) {
          aiState.currentGoal = newGoal;
          aiState.lastDecisionTime = now;
          logger.debug(
            `🔄 [AI] ${agentId}: Re-evaluated from queue -> ${newGoal.type}`,
          );
        }
      } catch (error) {
        logger.error(`Error re-evaluating agent ${agentId}`, { error });
      }

      this.pendingReEvaluations.delete(agentId);
      processed++;
    }
  }

  /**
   * Invalidates cached evaluation results.
   * Called periodically to ensure cache doesn't become stale.
   */
  private invalidateCache(): void {
    this.zoneCache.clear();
    this.craftingZoneCache = null;
    this._activeAgentIdsCache = null;
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
   * Uses soft invalidation for timeouts to prevent cascade saturation.
   *
   * @param agentId - Agent identifier
   * @param aiState - Agent's AI state
   * @param now - Current timestamp
   */
  private async processAgent(
    agentId: string,
    aiState: AIState,
    now: number,
  ): Promise<void> {
    if (aiState.currentGoal) {
      if (this.isGoalCompleted(aiState.currentGoal, agentId)) {
        this.completeGoal(aiState, agentId);
      } else if (
        this.goalValidator.isGoalHardInvalid(aiState.currentGoal, agentId)
      ) {
        this.failGoal(aiState, agentId);
      } else if (
        this.goalValidator.isGoalTimedOut(aiState.currentGoal, agentId)
      ) {
        if (!this.pendingReEvaluations.has(agentId)) {
          this.pendingReEvaluations.add(agentId);
          logger.debug(
            `⏰ [AI] ${agentId}: Goal timeout, queued for re-evaluation (queue size: ${this.pendingReEvaluations.size})`,
          );
        }

        aiState.currentGoal = null;
        aiState.currentAction = null;
        return;
      } else if (aiState.currentAction) {
        const highPriorityGoal = aiState.goalQueue.find(
          (g) =>
            g.priority >= 0.88 &&
            g.priority > aiState.currentGoal!.priority + 0.05,
        );
        if (highPriorityGoal) {
          logger.info(
            `🚨 [AI] ${agentId}: PREEMPTING current goal (priority=${aiState.currentGoal.priority.toFixed(2)}) with higher priority goal (${highPriorityGoal.type}, priority=${highPriorityGoal.priority.toFixed(2)})`,
          );

          aiState.goalQueue = aiState.goalQueue.filter(
            (g) => g.id !== highPriorityGoal.id,
          );

          if (aiState.currentGoal) {
            aiState.goalQueue.push(aiState.currentGoal);
          }

          aiState.currentGoal = highPriorityGoal;
          aiState.currentAction = null;
          aiState.lastDecisionTime = now;
          simulationEvents.emit(GameEventType.AGENT_GOAL_CHANGED, {
            agentId,
            newGoal: highPriorityGoal,
            timestamp: now,
          });
        } else {
          return;
        }
      }
    }

    const MAX_QUEUED_GOALS = 10;
    if (aiState.goalQueue.length < MAX_QUEUED_GOALS) {
      this.prePlanGoals(agentId, aiState, now, MAX_QUEUED_GOALS);
    }

    if (!aiState.currentGoal) {
      if (aiState.goalQueue.length > 0) {
        aiState.goalQueue.sort((a, b) => b.priority - a.priority);
        aiState.currentGoal = aiState.goalQueue.shift() ?? null;
        aiState.lastDecisionTime = now;
        if (aiState.currentGoal) {
          logger.debug(
            `🎯 [AI] ${agentId}: ${describeGoal(aiState.currentGoal)} (from queue, priority=${aiState.currentGoal.priority.toFixed(2)})`,
          );
          simulationEvents.emit(GameEventType.AGENT_GOAL_CHANGED, {
            agentId,
            newGoal: aiState.currentGoal,
            timestamp: now,
          });
        }
      }
      if (!aiState.currentGoal) {
        const startTime = performance.now();
        const newGoal = await this.makeDecision(agentId, aiState, now);
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
          simulationEvents.emit(GameEventType.AGENT_GOAL_CHANGED, {
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

      if (aiState.currentAction) {
        return;
      }

      const isMoving = this._movementSystem?.isMoving(agentId);
      if (isMoving) {
        return;
      }

      const action = this.planAction(agentId, aiState.currentGoal);

      if (action) {
        if (action.targetId) {
          const targetEntity = this.gameState.entities?.find(
            (e) => e.id === action.targetId,
          );
          const targetAgent = this.agentRegistry?.getProfile(action.targetId);
          if (
            (targetEntity && targetEntity.isDead) ||
            (targetAgent && targetAgent.isDead)
          ) {
            aiState.currentGoal = null;
            aiState.currentAction = null;
            return;
          }
        }

        aiState.currentAction = action;

        logger.debug(`🏃 [AI] ${agentId}: ${describeAction(action)}`);
        this.executeAction(action);
        simulationEvents.emit(GameEventType.AGENT_ACTION_COMMANDED, {
          agentId,
          action,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Fallback exploratory movement when no goal is selected.
   * Conditions (any of these triggers exploration):
   * - Inventory empty (no food, water, wood, stone)
   * - Needs all > 70 (low urgency, can afford to explore)
   * - No goal assigned for > 5 seconds (prevents agent getting stuck)
   * - Agent not already moving
   * - MovementSystem available
   * Action: pick a random point in radius and move there to stimulate discovery.
   */
  private maybeFallbackExplore(agentId: string, aiState: AIState): void {
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

    const timeSinceDecision = Date.now() - (aiState.lastDecisionTime || 0);
    const stuckWithoutGoal = !aiState.currentGoal && timeSinceDecision > 5000;

    if (!inventoryEmpty && !needsSatisfied && !stuckWithoutGoal) return;

    const pos = this.agentRegistry?.getPosition(agentId);
    if (!pos) return;

    const radius = 400 + Math.random() * 600;
    const angle = Math.random() * Math.PI * 2;
    let targetX = pos.x + Math.cos(angle) * radius;
    let targetY = pos.y + Math.sin(angle) * radius;
    const mapWidth = this.gameState.worldSize?.width || 2000;
    const mapHeight = this.gameState.worldSize?.height || 2000;
    targetX = Math.max(50, Math.min(mapWidth - 50, targetX));
    targetY = Math.max(50, Math.min(mapHeight - 50, targetY));

    this._movementSystem.moveToPoint(agentId, targetX, targetY);
    logger.debug(
      `🚶 [AI] Fallback explore triggered for ${agentId} (stuckWithoutGoal=${stuckWithoutGoal})`,
    );
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
    if (aiState.isInCombat) return;

    const needs = this.needsSystem?.getNeeds(agentId);

    const canFindWater = this.findNearestResourceForEntity(
      agentId,
      "water_source",
    );

    const thirstBlocks = needs && needs.thirst < 40 && canFindWater !== null;
    const hungerBlocks = needs && needs.hunger < 40;
    const energyBlocks = needs && needs.energy < 30;

    if (hungerBlocks || thirstBlocks || energyBlocks) {
      return;
    }

    const excludedIds = new Set<string>();
    if (aiState.currentGoal?.targetId) {
      excludedIds.add(aiState.currentGoal.targetId);
    }
    for (const g of aiState.goalQueue) {
      if (g.targetId) excludedIds.add(g.targetId);
    }

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
        excludedIds.add(workGoal.targetId);
      } else {
        break;
      }
    }
  }

  /**
   * Generates a work goal based on agent's role and colony needs.
   * Uses the WorkGoalGenerator helper for most roles, with special handling for hunters.
   *
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

    const excluded = new Set(excludeTargetIds);
    if (aiState.currentGoal?.targetId) {
      excluded.add(aiState.currentGoal.targetId);
    }
    for (const g of aiState.goalQueue) {
      if (g.targetId) excluded.add(g.targetId);
    }

    if (role === RoleType.HUNTER) {
      const huntGoal = this.generateHunterGoal(agentId, now, excluded);
      if (huntGoal) return huntGoal;
    }

    return generateRoleBasedWorkGoal(
      agentId,
      role,
      now,
      excluded,
      (entityId, resourceType) =>
        this.findNearestResourceForEntity(entityId, resourceType),
    );
  }

  /**
   * Generates a hunt goal for hunters, handling weapon acquisition and animal finding.
   * Returns null if no hunt is possible, allowing fallback to regular gathering.
   */
  private generateHunterGoal(
    agentId: string,
    now: number,
    excluded: Set<string>,
  ): AIGoal | null {
    const hasWeapon =
      this.equipmentSystem.getEquippedItem(agentId, EquipmentSlot.MAIN_HAND) !==
      undefined;

    if (!hasWeapon) {
      const weapon = toolStorage.findToolForRole("hunter");
      if (weapon && toolStorage.claimTool(agentId, weapon)) {
        this.equipmentSystem.equipItem(
          agentId,
          EquipmentSlot.MAIN_HAND,
          weapon,
        );
        logger.debug(
          `🗡️ [AI] ${agentId}: Claimed weapon ${weapon} from storage`,
        );
      } else {
        logger.debug(
          `⚠️ [AI] ${agentId}: No weapon available, falling back to gathering`,
        );
        return null;
      }
    }

    const canHunt =
      this.equipmentSystem.getEquippedItem(agentId, EquipmentSlot.MAIN_HAND) !==
      undefined;

    if (!canHunt) return null;

    const animal = this.findNearestHuntableAnimal(agentId, excluded);
    if (!animal) {
      logger.debug(`🐺 [AI] ${agentId}: No huntable animals found`);
      return null;
    }

    logger.debug(
      `🎯 [AI] ${agentId}: Creating HUNT goal for ${animal.id} (${animal.type})`,
    );

    return {
      id: `hunt_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
      type: GoalTypeEnum.HUNT,
      priority: 0.6,
      targetId: animal.id,
      targetPosition: { x: animal.x, y: animal.y },
      data: {
        taskType: TaskType.HUNT_ANIMAL,
        animalType: animal.type,
      },
      createdAt: now,
    };
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
  private async makeDecision(
    agentId: string,
    aiState: AIState,
    now: number,
  ): Promise<AIGoal | null> {
    const t0 = performance.now();
    let goal: AIGoal | null = null;

    try {
      goal = await this.processGoals(agentId, aiState, now);
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
    const pos = this.agentRegistry?.getPosition(agentId);
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

  private async processGoals(
    agentId: string,
    aiState: AIState,
    now: number,
  ): Promise<AIGoal | null> {
    const simpleDeps = this.getSimplifiedDeps();
    const fullGoals = planGoalsFull(simpleDeps, aiState, now);

    const collectiveGoals = this.evaluateCollectiveGoals(aiState, now);

    const allGoals = [...fullGoals, ...collectiveGoals].sort(
      (a, b) => b.priority - a.priority,
    );

    const needs = this.needsSystem?.getNeeds(agentId);
    if (needs && allGoals.length > 0) {
      const topGoal = allGoals[0];

      if (topGoal.type === GoalType.SATISFY_HUNGER && !topGoal.targetPosition) {
        const foodGoal = this.createUrgentFoodGoal(agentId, now);
        if (foodGoal?.targetPosition) {
          topGoal.targetPosition = foodGoal.targetPosition;
          topGoal.targetId = foodGoal.targetId;
          topGoal.data = { ...topGoal.data, ...foodGoal.data };
        }
      }

      if (topGoal.type === GoalType.SATISFY_THIRST && !topGoal.targetPosition) {
        const waterGoal = this.createUrgentWaterGoal(agentId, now);
        if (waterGoal?.targetPosition) {
          topGoal.targetPosition = waterGoal.targetPosition;
          topGoal.targetId = waterGoal.targetId;
          topGoal.data = { ...topGoal.data, ...waterGoal.data };
        }
      }

      if (topGoal.type === GoalType.REST && !topGoal.targetPosition) {
        const restGoal = this.createUrgentRestGoal(agentId, now);
        if (restGoal?.targetPosition) {
          topGoal.targetPosition = restGoal.targetPosition;
          topGoal.targetZoneId = restGoal.targetZoneId;
        }
      }
    }

    if (allGoals.length > 0) {
      const goal = allGoals[0];
      const jitter = Math.floor(Math.random() * this.GOAL_JITTER_RANGE_MS);
      goal.createdAt = goal.createdAt - jitter;
      logger.debug(
        `🎯 [AI] ${agentId}: Using goal ${goal.type} (priority=${goal.priority.toFixed(2)})`,
      );
      return goal;
    }

    return null;
  }

  /**
   * Evaluates collective/community goals for an agent.
   * Creates community tasks for resource shortages and allows agents to join them.
   */
  private evaluateCollectiveGoals(aiState: AIState, now: number): AIGoal[] {
    if (!this.taskSystem) return [];

    const ctx: CollectiveNeedsContext = {
      gameState: this.gameState,
      getAgentInventory: (id: string) =>
        this.inventorySystem?.getAgentInventory(id),
      getAgentRole: (id: string) => this.roleSystem?.getAgentRole(id),
      getEntityPosition: (id: string) =>
        this.agentRegistry?.getPosition(id) ?? null,
      getAllStockpiles: () => this.inventorySystem?.getAllStockpiles() ?? [],
      getActiveDemands: () => {
        const governance = this.gameState.governance;
        if (!governance?.demands) return [];
        return governance.demands.filter((d) => !d.resolvedAt);
      },
      getPopulation: () =>
        this.gameState.agents?.filter((a) => !a.isDead).length ?? 0,
      taskSystem: {
        createTask: (params) => this.taskSystem!.createTask(params),
        getAvailableCommunityTasks: () =>
          this.taskSystem!.getAvailableCommunityTasks(),
        claimTask: (taskId, agentId) =>
          this.taskSystem!.claimTask(taskId, agentId),
      },
    };

    return evaluateCollectiveNeeds(ctx, aiState, now);
  }

  /**
   * GPU-accelerated search for nearby agents within a radius.
   * Uses pairwise distance computation on GPU when there are many agents.
   *
   * @param entityId - The entity to search from
   * @param radius - Search radius
   * @returns Array of nearby agents with their distances, sorted by distance
   */

  /**
   * Returns simplified dependencies for the rule-based goal planner.
   * Much lighter than getDeps() - only 5 fields vs 30+.
   */
  private simplifiedDepsCache: SimplifiedGoalPlannerDeps | null = null;

  private getSimplifiedDeps(): SimplifiedGoalPlannerDeps {
    if (this.simplifiedDepsCache) return this.simplifiedDepsCache;

    this.simplifiedDepsCache = {
      gameState: this.gameState,
      getEntityNeeds: (id: string) => this.needsSystem?.getNeeds(id),
      getAgentInventory: (id: string) =>
        this.inventorySystem?.getAgentInventory(id),
      getEntityPosition: (id: string) =>
        this.agentRegistry?.getPosition(id) ?? undefined,
      getAgentRole: (id: string) => {
        const role = this.roleSystem?.getAgentRole(id);
        return role ? { roleType: role.roleType } : undefined;
      },

      getEnemies: (id: string) =>
        this.combatSystem?.getNearbyEnemies(id, 200) ?? undefined,
      getNearbyPredators: (id: string) => {
        const pos = this.agentRegistry?.getPosition(id);
        if (!pos) return undefined;
        return (
          this.animalSystem
            ?.getAnimalsInRadius(pos, 150)
            .filter((a) => getAnimalConfig(a.type)?.isPredator)
            .map((a) => ({ id: a.id, position: a.position })) ?? undefined
        );
      },
      isWarrior: (id: string) =>
        this.roleSystem?.getAgentRole(id)?.roleType === RoleType.GUARD,
      getEntityStats: (id: string) => {
        const entity = this.gameState.entities?.find((e) => e.id === id);
        return entity?.stats
          ? {
              health: entity.stats.health ?? 100,
              morale: entity.stats.morale ?? 60,
            }
          : null;
      },

      getBuildTasks: (id: string) => {
        const tasks = this.taskSystem?.getActiveTasks() ?? [];
        const pos = this.agentRegistry?.getPosition(id);
        if (!pos) return undefined;

        return tasks
          .filter(
            (t) => t.type === TaskType.BUILD_HOUSE && !t.completed && t.zoneId,
          )
          .map((t) => {
            const zone = this.gameState.zones?.find((z) => z.id === t.zoneId);
            if (!zone?.bounds) return null;
            const cx = zone.bounds.x + zone.bounds.width / 2;
            const cy = zone.bounds.y + zone.bounds.height / 2;
            const d = Math.hypot(cx - pos.x, cy - pos.y);
            const minW = t.requirements?.minWorkers ?? 1;
            const have = t.contributors?.size ?? 0;
            const score = Math.max(0, minW - have) * 2 - d / 600;
            return { id: t.id, zoneId: t.zoneId!, score };
          })
          .filter(Boolean)
          .sort((a, b) => b!.score - a!.score) as Array<{
          id: string;
          zoneId: string;
          score: number;
        }>;
      },

      getDepositZone: (id: string) => {
        const inv = this.inventorySystem?.getAgentInventory(id);
        if (!inv) return undefined;
        const storageZones = this.gameState.zones
          ?.filter((z) => z.type === ZoneType.STORAGE)
          .map((z) => z.id);
        if (storageZones && storageZones.length > 0) return storageZones[0];

        return this.gameState.zones?.find((z) => z.type === ZoneType.WORK)?.id;
      },

      getEquippedWeapon: (id: string) =>
        this.combatSystem?.getEquipped(id) ?? "unarmed",
      canCraftWeapon: (id: string, weaponId: string) => {
        if (!this.craftingSystem) return false;
        const validWeaponIds: CraftingWeaponId[] = [
          CraftingWeaponId.WOODEN_CLUB,
          CraftingWeaponId.STONE_DAGGER,
        ];
        if (!validWeaponIds.includes(weaponId as CraftingWeaponId))
          return false;
        return this.craftingSystem.canCraftWeapon(
          id,
          weaponId as CraftingWeaponId,
        );
      },
      getCraftZone: () => {
        if (this.craftingZoneCache !== null) return this.craftingZoneCache;
        let zone = this.gameState.zones?.find((z) => z.type === ZoneType.WORK);
        if (!zone)
          zone = this.gameState.zones?.find((z) => z.type === ZoneType.STORAGE);
        this.craftingZoneCache = zone?.id;
        return this.craftingZoneCache;
      },
      hasAvailableWeapons: () => toolStorage.hasAnyWeapon(),
    };

    return this.simplifiedDepsCache;
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
  // @ts-expect-error Reserved for future use
  private _createUrgentSocialGoal(agentId: string, now: number): AIGoal | null {
    return this.urgentGoals.createUrgentSocialGoal(agentId, now);
  }

  /**
   * Create urgent fun goal when fun need is critical
   * Fun needs are least critical, priority 8
   */
  // @ts-expect-error Reserved for future use
  private _createUrgentFunGoal(agentId: string, now: number): AIGoal | null {
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
  public setEntityPriority(entityId: string, priority: AgentPriority): void {
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
   * @returns Performance metrics including decision counts, goal completion rates, and timeout stats
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
      goalsTimedOut: this.goalValidator.goalsTimedOut,
      goalsExpired: this.goalValidator.goalsExpired,
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
    this._activeAgentIdsCache = null;
  }

  /**
   * Cleans up all AI states and removes all event listeners.
   */
  public cleanup(): void {
    this.aiStates.clear();
    this.agentPriorities.clear();
    this.agentStrategies.clear();
    this.playerControlledAgents.clear();
    this._activeAgentIdsCache = null;
    this.zoneCache.clear();
    this.craftingZoneCache = null;
    this.nearestResourceCache.clear();
    this._goalsCompletedRef.value = 0;
    this.goalValidator.resetMetrics();
    this._decisionCount = 0;
    this._decisionTimeTotalMs = 0;
    simulationEvents.off(
      GameEventType.AGENT_ACTION_COMPLETE,
      this.boundHandleActionComplete,
    );
    this.removeAllListeners();
  }

  private isGoalCompleted(goal: AIGoal, agentId: string): boolean {
    return this.goalValidator.isGoalCompleted(goal, agentId);
  }

  private completeGoal(aiState: AIState, agentId: string): void {
    this.releaseResourceReservation(agentId);

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
    const targetId = aiState.currentGoal?.targetId;
    if (targetId) {
      if (!aiState.memory.failedTargets) {
        aiState.memory.failedTargets = new Map<string, number>();
      }
      aiState.memory.failedTargets.set(targetId, Date.now());

      if (aiState.memory.failedTargets.size > 20) {
        const entries = [...aiState.memory.failedTargets.entries()];
        entries.sort((a, b) => a[1] - b[1]);
        for (let i = 0; i < entries.length - 20; i++) {
          aiState.memory.failedTargets.delete(entries[i][0]);
        }
      }
    }

    this.releaseResourceReservation(agentId);
    this.goalValidator.failGoal(aiState);
  }

  private planAction(agentId: string, goal: AIGoal): AgentAction | null {
    return this.actionPlanner.planAction(agentId, goal);
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
      const agent =
        this.agentRegistry?.getProfile(agentId) ??
        this.gameState.agents?.find((a) => a.id === agentId);
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
        ? (id: string): boolean => this._movementSystem!.stopMovement(id)
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
      const reservedBy = this.resourceReservations.get(
        cached.resource?.id ?? "",
      );
      if (cached.resource && reservedBy === entityId) {
        return cached.resource;
      }
    }

    const agent = this.agentRegistry?.getProfile(entityId);
    if (!agent?.position) return null;

    const targetWorldTypes = itemToWorldResources(resourceType);
    if (targetWorldTypes.length === 0) {
      targetWorldTypes.push(resourceType as WorldResourceType);
    }

    let nearest: { id: string; x: number; y: number } | null = null;

    if (this.worldResourceSystem) {
      let minDistance = Infinity;

      for (const worldType of targetWorldTypes) {
        const resource = this.worldResourceSystem.getNearestResource(
          agent.position.x,
          agent.position.y,
          worldType,
        );

        if (resource) {
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
    } else {
      const maxRadiusSq =
        this.MAX_RESOURCE_SEARCH_RADIUS * this.MAX_RESOURCE_SEARCH_RADIUS;
      let minDistance = maxRadiusSq;
      const harvestableStates = ["pristine", "harvested_partial"];

      if (this.gameState.worldResources) {
        for (const resource of Object.values(this.gameState.worldResources)) {
          if (
            !targetWorldTypes.includes(resource.type) ||
            !harvestableStates.includes(resource.state)
          )
            continue;

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
    }

    if (nearest) {
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

  // @ts-expect-error Reserved for future use
  private _findAgentWithResource(
    entityId: string,
    resourceType: ResourceType.FOOD | ResourceType.WATER,
    minAmount: number,
  ): { agentId: string; x: number; y: number } | null {
    const agent = this.agentRegistry?.getProfile(entityId);
    if (!agent?.position) return null;

    let nearest: { agentId: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    const profiles = this.agentRegistry
      ? this.agentRegistry.getAllProfiles()
      : (this.gameState.agents || []).values();

    for (const other of profiles) {
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

  // @ts-expect-error Reserved for future use
  private _findPotentialMate(
    entityId: string,
  ): { id: string; x: number; y: number } | null {
    const agent = this.agentRegistry?.getProfile(entityId);
    if (!agent?.position) return null;

    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    const profiles = this.agentRegistry
      ? this.agentRegistry.getAllProfiles()
      : (this.gameState.agents || []).values();

    for (const other of profiles) {
      if (other.id === entityId || other.isDead) continue;
      if (!other.position) continue;

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

  // @ts-expect-error Reserved for future use
  private _findNearbyAgent(
    entityId: string,
  ): { id: string; x: number; y: number } | null {
    const agent = this.agentRegistry?.getProfile(entityId);
    if (!agent?.position) return null;

    let nearest: { id: string; x: number; y: number } | null = null;
    let minDistance = Infinity;

    const profiles = this.agentRegistry
      ? this.agentRegistry.getAllProfiles()
      : (this.gameState.agents || []).values();

    for (const other of profiles) {
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
   * @param entityId - The agent ID
   * @param excludeIds - Set of animal IDs to exclude from search
   */
  private findNearestHuntableAnimal(
    entityId: string,
    excludeIds?: Set<string>,
  ): { id: string; x: number; y: number; type: string } | null {
    const agentProfile = this.agentRegistry?.getProfile(entityId);
    if (!agentProfile?.position) return null;

    if (!this.animalSystem) {
      logger.debug(`🐺 [AI] ${entityId}: animalSystem not available`);
      return null;
    }

    const agentPos = agentProfile.position;
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
      if (excludeIds?.has(animal.id)) continue;
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
  // @ts-expect-error Reserved for future use
  private async _getNearbyAgentsWithDistancesGPU(
    entityId: string,
    radius: number,
  ): Promise<Array<{ id: string; distance: number }>> {
    const myAgent = this.agentRegistry?.getProfile(entityId);
    if (!myAgent?.position) return [];

    const activeAgents: Array<{
      id: string;
      position: { x: number; y: number };
    }> = [];
    if (this.agentRegistry) {
      for (const a of this.agentRegistry.getAllProfiles()) {
        if (!a.isDead && a.id !== entityId && a.position) {
          activeAgents.push({ id: a.id, position: a.position });
        }
      }
    } else {
      for (const a of this.gameState.agents) {
        if (!a.isDead && a.id !== entityId && a.position) {
          activeAgents.push({ id: a.id, position: a.position });
        }
      }
    }

    if (activeAgents.length === 0) return [];

    const GPU_THRESHOLD = 30;
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

      const distancesSq = await this.gpuService.computeDistancesBatch(
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

    if (
      payload.actionType === ActionType.MOVE &&
      aiState.currentAction?.actionType !== ActionType.MOVE
    ) {
      return;
    }

    const prevAction = aiState.currentAction?.actionType;
    aiState.currentAction = null;

    if (!payload.success) {
      this.failGoal(aiState, payload.agentId);
      return;
    }

    if (payload.actionType === ActionType.MOVE) {
      logger.debug(
        `📍 [AI] ${payload.agentId}: arrived (prev=${prevAction ?? "none"}), ready for harvest`,
      );

      if (
        aiState.currentGoal?.type === GoalTypeEnum.HUNT &&
        aiState.currentGoal.targetId
      ) {
        const animal = this.animalSystem?.getAnimal(
          aiState.currentGoal.targetId,
        );
        if (animal && !animal.isDead) {
          const agentPos = this.agentRegistry?.getPosition(payload.agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - animal.position.x,
              agentPos.y - animal.position.y,
            );

            if (dist < 80) {
              logger.debug(
                `⚔️ [AI] ${payload.agentId}: In range (${dist.toFixed(0)}), attacking ${animal.id}`,
              );
              const attackAction: AgentAction = {
                actionType: ActionType.ATTACK,
                agentId: payload.agentId,
                targetId: animal.id,
                timestamp: Date.now(),
              };
              aiState.currentAction = attackAction;
              this.executeAction(attackAction);
              return;
            }

            aiState.currentGoal.targetPosition = {
              x: animal.position.x,
              y: animal.position.y,
            };
          }
        } else {
          aiState.currentGoal = null;
        }
      }
      return;
    }

    if (
      payload.actionType === ActionType.HARVEST ||
      payload.actionType === ActionType.ATTACK
    ) {
      this.completeGoal(aiState, payload.agentId);
      return;
    }

    if (
      payload.actionType === ActionType.WORK &&
      payload.data &&
      typeof payload.data.taskId === "string"
    ) {
      const task = this.taskSystem?.getTask(payload.data.taskId);
      if (task && !task.completed) {
        return;
      }
    }

    if (aiState.currentGoal) {
      const goalType = aiState.currentGoal.type;

      if (goalType.startsWith(GoalPrefix.SATISFY)) {
        const needType = aiState.currentGoal.data?.need as string;
        if (needType && this.needsSystem) {
          const needs = this.needsSystem.getNeeds(payload.agentId);
          if (needs) {
            const needValue = needs[needType as keyof typeof needs] as number;
            if (needValue <= 50) {
              return;
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
      simulationEvents.emit(GameEventType.AGENT_GOAL_CHANGED, {
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

  /**
   * Handles role reassignment events to auto-equip appropriate tools.
   * When an agent gets a new role, we check their inventory for suitable
   * tools and equip the best one for their new role.
   */
  private handleRoleReassigned(payload: {
    agentId: string;
    newRole: string;
    previousRole?: string;
  }): void {
    const { agentId, newRole } = payload;

    const inventory = this.inventorySystem?.getAgentInventory(agentId);
    if (!inventory) return;

    const availableItems: string[] = [];
    for (const [itemId, quantity] of Object.entries(inventory)) {
      if (quantity > 0) {
        availableItems.push(itemId);
      }
    }

    const equipped = this.equipmentSystem.autoEquipForRole(
      agentId,
      newRole,
      availableItems,
    );

    if (equipped) {
      logger.info(
        `🗡️ [Equipment] ${agentId}: Auto-equipped ${equipped} for role ${newRole}`,
      );
    } else {
      if (
        newRole.toLowerCase() === "hunter" ||
        newRole.toLowerCase() === "guard"
      ) {
        const weapon = this.equipmentSystem.autoEquipBestWeapon(
          agentId,
          availableItems,
          newRole.toLowerCase() === "hunter",
        );
        if (weapon) {
          logger.info(
            `🗡️ [Equipment] ${agentId}: Auto-equipped weapon ${weapon} for ${newRole}`,
          );
        }
      }
    }
  }
}
