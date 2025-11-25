import { logger } from "../../../infrastructure/utils/logger";
import type { ResourceType } from "../../types/simulation/economy";
import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import {
  AIGoal,
  AIState,
  AgentAction,
  AgentPersonality,
} from "../../types/simulation/ai";
import type { AgentTraits, LifeStage } from "../../types/simulation/agents";
import type { WorldResourceType } from "../../types/simulation/worldResources";
import { getAnimalConfig } from "../../../infrastructure/services/world/config/AnimalConfigs";
import type { Task } from "../../types/simulation/tasks";
import type { WeaponId as CraftingWeaponId } from "../../types/simulation/crafting";
import type { Quest } from "../../types/simulation/quests";
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
import type { TimeSystem } from "./TimeSystem";
import type { EntityIndex } from "../core/EntityIndex";

interface AISystemConfig {
  updateIntervalMs: number;
  enablePersonality: boolean;
  enableMemory: boolean;
  maxMemoryItems: number;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

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

  public update(_deltaTimeMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      this.checkDependencies();
      return;
    }

    if (now - this._lastMemoryCleanupTime >= this.MEMORY_CLEANUP_INTERVAL) {
      this.cleanupAgentMemory(now);
      this._lastMemoryCleanupTime = now;
    }

    this.lastUpdate = now;
    const agents = this.gameState.agents || [];

    const BATCH_SIZE = 25;
    const batchSize = Math.min(BATCH_SIZE, agents.length);
    let _processed = 0;

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

      this.processAgent(agent.id, aiState, now);
      _processed++;
    }

    this.agentIndex = (this.agentIndex + batchSize) % agents.length;
  }

  private processAgent(agentId: string, aiState: AIState, now: number): void {
    if (aiState.currentGoal) {
      if (this.isGoalCompleted(aiState.currentGoal, agentId)) {
        this.completeGoal(aiState, agentId);
      } else if (this.isGoalInvalid(aiState.currentGoal, agentId)) {
        this.failGoal(aiState, agentId);
      } else {
        return;
      }
    }

    if (!aiState.currentGoal) {
      const startTime = performance.now();
      const newGoal = this.makeDecision(agentId, aiState);
      const endTime = performance.now();

      this._decisionTimeTotalMs += endTime - startTime;
      this._decisionCount++;

      if (newGoal) {
        aiState.currentGoal = newGoal;
        logger.debug(
          `🎯 [AI] Agent ${agentId} new goal: ${newGoal.type} target=${newGoal.targetId || newGoal.targetZoneId || "none"}`,
        );
        simulationEvents.emit(GameEventNames.AGENT_GOAL_CHANGED, {
          agentId,
          newGoal,
          timestamp: now,
        });
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

  private makeDecision(_agentId: string, aiState: AIState): AIGoal | null {
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
        const agent =
          this.entityIndex?.getAgent(id) ??
          this.gameState.agents.find((a) => a.id === id);
        if (!agent?.position) return undefined;
        const zone = this.gameState.zones.find((z) => {
          return (
            agent.position &&
            agent.position.x >= z.bounds.x &&
            agent.position.x <= z.bounds.x + z.bounds.width &&
            agent.position.y >= z.bounds.y &&
            agent.position.y <= z.bounds.y + z.bounds.height
          );
        });
        return zone?.id;
      },
      getEquipped: (id: string) =>
        this.combatSystem?.getEquipped(id) || "unarmed",
      getSuggestedCraftZone: () => {
        const zone = this.gameState.zones?.find((z) => z.type === "crafting");
        return zone?.id;
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
        const activeIds: string[] = [];
        for (const agent of this.gameState.agents) {
          const entity = this.gameState.entities?.find(
            (e) => e.id === agent.id,
          );
          if (!entity?.isDead) {
            activeIds.push(agent.id);
          }
        }
        return activeIds;
      },
      getEntityStats: (id: string) => {
        const entity = this.gameState.entities?.find((e) => e.id === id);
        if (!entity) return null;
        const stats = entity.stats;
        if (!stats) return null;
        return {
          health: stats.health ?? 100,
          stamina: stats.stamina ?? 100,
          attack: stats.attack ?? 10,
          defense: stats.defense ?? 0,
        };
      },
      getPreferredResourceForRole: (role: string): string | undefined => {
        const roleSys = this.roleSystem;
        if (!roleSys) {
          return undefined;
        }
        const method = roleSys.getPreferredResourceForRole as (
          roleType: string,
        ) => string | undefined;
        return method(role);
      },
      getStrategy: (id: string) => this.agentStrategies.get(id) || "peaceful",
      isWarrior: (id: string) => {
        const role = this.roleSystem?.getAgentRole(id);
        return role?.roleType === "guard";
      },
      getNearbyPredators: (pos: { x: number; y: number }, range: number) => {
        const animalSys = this.animalSystem;
        if (!animalSys) return [];
        const animals = animalSys.getAnimalsInRadius(pos, range);
        return animals
          .filter((a) => {
            const config = getAnimalConfig(a.type);
            return config?.isPredator;
          })
          .map((a) => ({ id: a.id, position: a.position }));
      },
      getEnemiesForAgent: (id: string, threshold?: number): string[] => {
        if (!this.combatSystem) return [];
        return this.combatSystem.getNearbyEnemies(id, threshold);
      },
      getTasks: this.taskSystem
        ? (): Task[] => this.taskSystem!.getActiveTasks()
        : undefined,
      getActiveQuests: this.questSystem
        ? (): Quest[] => this.questSystem!.getActiveQuests()
        : undefined,
      getAvailableQuests: this.questSystem
        ? (): Quest[] => this.questSystem!.getAvailableQuests()
        : undefined,
      getCurrentTimeOfDay: this.timeSystem
        ? ():
            | "dawn"
            | "morning"
            | "midday"
            | "afternoon"
            | "dusk"
            | "night"
            | "deep_night" => {
            const time = this.timeSystem!.getCurrentTimeOfDay();
            if (time === "evening") return "dusk";
            if (time === "rest") return "deep_night";
            return time as
              | "dawn"
              | "morning"
              | "midday"
              | "afternoon"
              | "dusk"
              | "night"
              | "deep_night";
          }
        : undefined,
      getEntityPosition: (id: string) => {
        const agent =
          this.entityIndex?.getAgent(id) ??
          this.gameState.agents.find((a) => a.id === id);
        if (agent?.position) {
          return { x: agent.position.x, y: agent.position.y };
        }
        const entity =
          this.entityIndex?.getEntity(id) ??
          this.gameState.entities?.find((e) => e.id === id);
        if (entity?.position) {
          return { x: entity.position.x, y: entity.position.y };
        }
        return null;
      },
    };

    const goals = planGoals(deps, aiState);

    if (goals.length > 0) {
      return goals[0];
    }

    return null;
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
        lastMemoryCleanup: Date.now(),
      },
      currentGoal: null,
      goalQueue: [],
      lastDecisionTime: Date.now(),
      currentAction: null,
      offDuty: false,
    };
  }

  public notifyEntityArrived(entityId: string, zoneId: string): void {
    const aiState = this.aiStates.get(entityId);
    if (!aiState || !aiState.currentGoal) return;

    const goal = aiState.currentGoal;

    aiState.memory.visitedZones.add(zoneId);

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
    if (zone) {
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

  public isPlayerControlled(entityId: string): boolean {
    return this.playerControlledAgents.has(entityId);
  }

  public setEntityPriority(
    entityId: string,
    priority: "survival" | "normal" | "social",
  ): void {
    this.agentPriorities.set(entityId, priority);
  }

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
        if (this.isValidWorldResourceType(resourceTypeStr)) {
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
        if (this.isValidWorldResourceType(resourceTypeStr)) {
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
    this._goalsCompleted++;
  }

  private failGoal(aiState: AIState, _agentId: string): void {
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
      case "satisfy_need":
        // Handle satisfy_need goals with targetPosition (resource-based)
        if (goal.targetId && goal.targetPosition) {
          const agentPos = this.getAgentPosition(agentId);
          if (agentPos) {
            const dist = Math.hypot(
              agentPos.x - goal.targetPosition.x,
              agentPos.y - goal.targetPosition.y,
            );
            // If close enough to resource, harvest it
            if (dist < 60) {
              return {
                actionType: "harvest",
                agentId,
                targetId: goal.targetId,
                targetPosition: goal.targetPosition,
                timestamp,
              };
            }
            // Move towards resource
            return {
              actionType: "move",
              agentId,
              targetPosition: goal.targetPosition,
              timestamp,
            };
          }
        }
        // Fallback to zone-based movement or rest
        if (goal.targetZoneId) {
          return {
            actionType: "move",
            agentId,
            targetZoneId: goal.targetZoneId,
            timestamp,
          };
        }
        // For energy/rest needs without specific target
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

  public forceGoalReevaluation(agentId: string): void {
    const aiState = this.aiStates.get(agentId);
    if (aiState) {
      aiState.currentGoal = null;
      aiState.currentAction = null;
    }
  }

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
  }): void {
    const aiState = this.aiStates.get(payload.agentId);
    if (aiState) {
      aiState.currentAction = null;
      if (payload.success) {
        this.completeGoal(aiState, payload.agentId);
      } else {
        this.failGoal(aiState, payload.agentId);
      }
    }
  }

  private checkDependencies(): void {
    if (!this.needsSystem) logger.warn("AISystem: NeedsSystem missing");
    if (!this.roleSystem) logger.warn("AISystem: RoleSystem missing");
    if (!this.worldResourceSystem)
      logger.warn("AISystem: WorldResourceSystem missing");
    if (!this.inventorySystem) logger.warn("AISystem: InventorySystem missing");
    if (!this.socialSystem) logger.warn("AISystem: SocialSystem missing");
    if (!this.craftingSystem)
      logger.warn("AISystem: EnhancedCraftingSystem missing");
    if (!this.householdSystem) logger.warn("AISystem: HouseholdSystem missing");
  }

  private isValidWorldResourceType(value: string): value is WorldResourceType {
    const validTypes: WorldResourceType[] = [
      "tree",
      "rock",
      "trash_pile",
      "water_source",
      "berry_bush",
      "mushroom_patch",
      "wheat_crop",
    ];
    return validTypes.includes(value as WorldResourceType);
  }

  private executeAction(action: AgentAction): void {
    if (!this._movementSystem) return;

    switch (action.actionType) {
      case "move":
        if (action.targetZoneId) {
          // Check if already moving to this zone
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
          // Check if already moving to this position
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
        }
        break;
      case "harvest":
        if (action.targetId && this.worldResourceSystem) {
          const result = this.worldResourceSystem.harvestResource(
            action.targetId,
            action.agentId,
          );

          // After harvesting, apply need satisfaction and add to inventory
          if (result.success) {
            const resource = this.gameState.worldResources?.[action.targetId];
            if (resource) {
              // Map world resource type to inventory resource type
              let inventoryResourceType: ResourceType | null = null;

              // water_source -> water
              if (resource.type === "water_source") {
                inventoryResourceType = "water";
                if (this.needsSystem) {
                  this.needsSystem.satisfyNeed(action.agentId, "thirst", 30);
                }
              }
              // Food resources -> food
              else if (
                ["berry_bush", "mushroom_patch", "wheat_crop"].includes(
                  resource.type,
                )
              ) {
                inventoryResourceType = "food";
                if (this.needsSystem) {
                  this.needsSystem.satisfyNeed(action.agentId, "hunger", 25);
                }
              }
              // Wood resources -> wood
              else if (
                ["tree", "oak_tree", "pine_tree", "fallen_log"].includes(
                  resource.type,
                )
              ) {
                inventoryResourceType = "wood";
              }
              // Stone resources -> stone
              else if (
                ["stone_deposit", "rock", "iron_ore", "gold_ore"].includes(
                  resource.type,
                )
              ) {
                inventoryResourceType = "stone";
              }

              // Add harvested resource to agent's inventory
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
        // Agent is resting in place - apply small energy recovery
        if (this.needsSystem) {
          this.needsSystem.satisfyNeed(action.agentId, "energy", 5);
        }
        // Mark action as complete
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
}
