import { EventEmitter } from "events";
import { GameState } from "@/shared/types/game-types";
import { EntityNeedsData, NeedsConfig } from "@/shared/types/simulation/needs";
import { simulationEvents, GameEventType } from "../../../core/events";
import { logger } from "@/infrastructure/utils/logger";
import type { ILifeCyclePort } from "../../../ports";

import type { InventorySystem } from "../../economy/InventorySystem";
import type { SocialSystem } from "../../social/SocialSystem";
import { NeedsBatchProcessor } from "./NeedsBatchProcessor";
import { injectable, inject, unmanaged, optional } from "inversify";
import { TYPES } from "../../../../../config/Types";
import type { EntityIndex } from "../../../core/EntityIndex";
import type { SharedSpatialIndex } from "../../../core/SharedSpatialIndex";
import type { GPUComputeService } from "../../../core/GPUComputeService";
import type { AgentRegistry } from "../../agents/AgentRegistry";
import type { INeedsSystem } from "../../agents/SystemRegistry";
import type { StateDirtyTracker } from "../../../core/StateDirtyTracker";
import type { WorldQueryService } from "../../world/WorldQueryService";
import type { TerrainSystem } from "../../world/TerrainSystem";
import { getFrameTime } from "../../../../../shared/FrameTime";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../../../core/PerformanceMonitor";
import { FoodCatalog } from "../../../../data/FoodCatalog";
import {
  ResourceType,
  RestoreSource,
} from "../../../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";
import { NeedType, ActionType } from "../../../../../shared/constants/AIEnums";
import { LifeStage } from "../../../../../shared/constants/AgentEnums";
import { EntityType } from "../../../../../shared/constants/EntityEnums";
import { FoodCategory } from "../../../../../shared/constants/FoodEnums";
import type { FoodItem } from "@/shared/types/simulation/food";
import { SIMULATION_CONSTANTS } from "../../../../../shared/constants/SimulationConstants";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

import { GoalType } from "@/shared/constants/AIEnums";
/**
 * System for managing entity needs (hunger, thirst, energy, hygiene, social, fun, mental health).
 *
 * Features:
 * - Decay rates configurable per need type
 * - Cross-effects between needs (e.g., low energy affects social needs)
 * - Active resource consumption from inventory to satisfy needs
 * - Social morale boost from nearby friendly entities
 * - Batch processing for performance with many entities
 * - Age-based decay multipliers (children decay slower, elders faster)
 * - Divine favor modifiers to reduce decay
 *
 * Agents consume food/water from their inventory to satisfy hunger/thirst.
 * If inventory is empty, they must gather resources or trade.
 *
 * Uses NeedsBatchProcessor for vectorized operations when entity count >= 20.
 *
 * @see NeedsBatchProcessor for batch processing implementation
 * @see GPUComputeService for GPU-accelerated needs decay
 * @see InventorySystem for resource storage and consumption
 */
@injectable()
export class NeedsSystem extends EventEmitter implements INeedsSystem {
  private gameState: GameState;
  private config: NeedsConfig;
  private entityNeeds: Map<string, EntityNeedsData>;
  private lastUpdate: number = 0;

  private lifeCyclePort?: ILifeCyclePort;

  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;

  private respawnQueue = new Map<string, number>();

  private zoneCache = new Map<
    string,
    {
      zones: Array<{
        type: string;
        bounds: { x: number; y: number; width: number; height: number };
      }>;
      timestamp: number;
    }
  >();
  private readonly ZONE_CACHE_TTL = 15000;
  private _tickCounter = 0;
  private gpuService?: GPUComputeService;

  private batchProcessor: NeedsBatchProcessor;
  /**
   * Threshold for activating batch processing.
   * 5 entities: GPU batch is efficient even with small counts due to vectorization.
   * NeedsSystem processes 7 needs per entity, so 5 entities = 35 operations.
   */
  private readonly BATCH_THRESHOLD = 5;
  private entityIndex?: EntityIndex;
  private spatialIndex?: SharedSpatialIndex;
  private agentRegistry?: AgentRegistry;
  private worldQueryService?: WorldQueryService;
  private terrainSystem?: TerrainSystem;

  private entityActions = new Map<string, string>();

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @unmanaged() config?: Partial<NeedsConfig>,
    @unmanaged()
    systems?: {
      lifeCyclePort?: ILifeCyclePort;

      inventorySystem?: InventorySystem;
      socialSystem?: SocialSystem;
    },
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
    @inject(TYPES.SharedSpatialIndex)
    @optional()
    spatialIndex?: SharedSpatialIndex,
    @inject(TYPES.GPUComputeService)
    @optional()
    gpuService?: GPUComputeService,
    @inject(TYPES.AgentRegistry)
    @optional()
    agentRegistry?: AgentRegistry,
    @inject(TYPES.StateDirtyTracker)
    @optional()
    private dirtyTracker?: StateDirtyTracker,
    @inject(TYPES.WorldQueryService)
    @optional()
    worldQueryService?: WorldQueryService,
    @inject(TYPES.TerrainSystem)
    @optional()
    terrainSystem?: TerrainSystem,
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.spatialIndex = spatialIndex;
    this.gpuService = gpuService;
    this.agentRegistry = agentRegistry;
    this.worldQueryService = worldQueryService;
    this.terrainSystem = terrainSystem;
    this.config = {
      decayRates: {
        [NeedType.HUNGER]: 0.2,
        [NeedType.THIRST]: 0.3,
        [NeedType.ENERGY]: 0.15,
        [NeedType.HYGIENE]: 0.1,
        [NeedType.SOCIAL]: 0.15,
        [NeedType.FUN]: 0.15,
        [NeedType.MENTAL_HEALTH]: 0.08,
      },

      criticalThreshold: SIMULATION_CONSTANTS.NEEDS.CRITICAL_THRESHOLD,
      emergencyThreshold: SIMULATION_CONSTANTS.NEEDS.EMERGENCY_THRESHOLD,
      updateIntervalMs: 1000,
      allowRespawn: true,
      deathThresholds: {
        [NeedType.HUNGER]: 0,
        [NeedType.THIRST]: 0,
        [NeedType.ENERGY]: 0,
      },
      zoneBonusMultiplier: 1.0,
      crossEffectsEnabled: true,
      ...config,
    };

    this.entityNeeds = new Map();

    if (this.agentRegistry) {
      this.agentRegistry.registerNeeds(this.entityNeeds);
    }

    this.batchProcessor = new NeedsBatchProcessor(gpuService);
    if (gpuService?.isGPUAvailable()) {
      logger.info(
        "🧠 NeedsSystem: GPU acceleration enabled for batch processing",
      );
    }

    if (systems) {
      this.lifeCyclePort = systems.lifeCyclePort;

      this.inventorySystem = systems.inventorySystem;
      this.socialSystem = systems.socialSystem;
    }
  }

  /**
   * Sets system dependencies after construction.
   *
   * @param systems - Object containing system dependencies
   */
  public setDependencies(systems: {
    lifeCyclePort?: ILifeCyclePort;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
  }): void {
    if (systems.lifeCyclePort) this.lifeCyclePort = systems.lifeCyclePort;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
  }

  public setEntityAction(entityId: string, actionType: string): void {
    this.entityActions.set(entityId, actionType);
  }

  /**
   * Ensures all agents in gameState have their needs initialized.
   * This handles cases where agents were loaded from a save or created
   * before NeedsSystem was ready.
   */
  private syncNeedsWithAgents(): void {
    const agents = this.gameState.agents || [];
    let syncCount = 0;
    let reinitCount = 0;

    if (this.entityNeeds.size > 0 && this._tickCounter === 0) {
      const entityIds = Array.from(this.entityNeeds.keys()).join(", ");
      logger.debug(
        `🔍 NeedsSystem state: ${this.entityNeeds.size} entities: [${entityIds}]`,
      );
    }

    for (const agent of agents) {
      if (agent.isDead) continue;

      const existingNeeds = this.entityNeeds.get(agent.id);

      if (!existingNeeds) {
        this.initializeEntityNeeds(agent.id);
        syncCount++;
        logger.debug(
          `🔄 NeedsSystem auto-initialized needs for existing agent ${agent.name} (${agent.id})`,
        );
      } else {
        if (
          existingNeeds.hunger <= 0 ||
          existingNeeds.thirst <= 0 ||
          existingNeeds.energy <= 0
        ) {
          const oldValues = `h=${existingNeeds.hunger.toFixed(0)} t=${existingNeeds.thirst.toFixed(0)} e=${existingNeeds.energy.toFixed(0)}`;
          this.initializeEntityNeeds(agent.id);
          reinitCount++;
          logger.warn(
            `🔧 NeedsSystem re-initialized corrupted needs for ${agent.name} (${agent.id}): ${oldValues} -> 100/100/100`,
          );
        }
      }
    }

    if (syncCount > 0 || reinitCount > 0) {
      logger.info(
        `🔄 NeedsSystem: synced=${syncCount}, reinit=${reinitCount}, total=${agents.length}`,
      );
    }

    if (this._tickCounter === 0 && this.entityNeeds.size > 0) {
      const needsSummary = Array.from(this.entityNeeds.entries())
        .map(([id, n]) => `${id.slice(-6)}:h${n.hunger.toFixed(0)}`)
        .join(" ");
      logger.debug(`📊 [Needs] ${needsSummary}`);
    }
  }

  public syncToGameState(): void {
    if (!this.gameState.agents) return;

    for (const agent of this.gameState.agents) {
      const needs = this.entityNeeds.get(agent.id);
      if (needs) {
        agent.needs = { ...needs };
      }
    }
  }

  /**
   * Updates the needs system, processing all entity needs.
   * Uses batch processing if entity count >= BATCH_THRESHOLD.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (uses config interval)
   */
  /**
   * Updates the needs system, processing all entity needs.
   * Uses batch processing if entity count >= BATCH_THRESHOLD.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (uses config interval)
   */
  public async update(_deltaTimeMs: number): Promise<void> {
    const now = getFrameTime();

    this.processRespawnQueue(now);

    this.syncNeedsWithAgents();

    this._tickCounter = (this._tickCounter || 0) + 1;
    if (this._tickCounter >= 100) {
      this.cleanZoneCache(now);
      this._tickCounter = 0;
    }

    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }

    if (this.lastUpdate === 0) {
      this.lastUpdate = now;
      return;
    }

    const dtSeconds = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (Math.random() < 0.03) {
      const firstEntry = this.entityNeeds.entries().next().value;
      if (firstEntry) {
        const [agentId, needs] = firstEntry;
        logger.debug(
          `[NeedsSystem] ${agentId}: h=${Math.round(needs.hunger)}, t=${Math.round(needs.thirst)}, e=${Math.round(needs.energy)}, dt=${dtSeconds.toFixed(2)}s, size=${this.entityNeeds.size}`,
        );
      }
    }

    if (this.entityNeeds.size >= this.BATCH_THRESHOLD) {
      await this.updateBatch(dtSeconds, now);
    } else {
      this.updateTraditional(dtSeconds, now);
    }
  }

  private updateTraditional(dtSeconds: number, _now: number): void {
    const startTime = performance.now();

    if (Math.random() < 0.02) {
      const firstAgent = this.entityNeeds.entries().next().value;
      if (firstAgent) {
        const [agentId, needs] = firstAgent;
        logger.debug(
          `[NeedsSystem] Agent ${agentId}: h=${Math.round(needs.hunger)}, t=${Math.round(needs.thirst)}, e=${Math.round(needs.energy)}, dt=${dtSeconds.toFixed(2)}s`,
        );
      }
    }
    for (const [entityId, needs] of this.entityNeeds.entries()) {
      const entityStartTime = performance.now();
      const action = this.entityActions.get(entityId) || ActionType.IDLE;
      this.applyNeedDecay(needs, dtSeconds, entityId, action);
      this.consumeResourcesForNeeds(entityId, needs);
      this.applySocialMoraleBoost(entityId, needs);

      if (this.config.crossEffectsEnabled) {
        this.applyCrossEffects(needs);
      }

      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.checkEmergencyNeeds(entityId, needs);
      this.emitNeedEvents(entityId, needs);

      const entityDuration = performance.now() - entityStartTime;
      performanceMonitor.recordSubsystemExecution(
        "NeedsSystem",
        "updateEntity",
        entityDuration,
        entityId,
      );
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "NeedsSystem",
      "updateTraditional",
      duration,
    );
    this.dirtyTracker?.markDirty("agents");
  }

  private async updateBatch(dtSeconds: number, _now: number): Promise<void> {
    const startTime = performance.now();
    this.batchProcessor.rebuildBuffers(this.entityNeeds);

    const entityCount = this.entityNeeds.size;
    if (entityCount === 0) return;

    const ageMultipliers = new Float32Array(entityCount);
    const divineModifiers = new Float32Array(entityCount);
    const decayRates = new Float32Array(7);
    decayRates[0] = this.config.decayRates.hunger;
    decayRates[1] = this.config.decayRates.thirst;
    decayRates[2] = this.config.decayRates.energy;
    decayRates[3] = this.config.decayRates.hygiene;
    decayRates[4] = this.config.decayRates.social;
    decayRates[5] = this.config.decayRates.fun;
    decayRates[6] = this.config.decayRates.mentalHealth;

    const entityIdArray = this.batchProcessor.getEntityIdArray();
    for (let i = 0; i < entityCount; i++) {
      const entityId = entityIdArray[i];
      ageMultipliers[i] = this.getAgeDecayMultiplier(entityId);

      divineModifiers[i] = 1.0;
    }

    await this.batchProcessor.applyDecayBatch(
      decayRates,
      ageMultipliers,
      divineModifiers,
      dtSeconds,
    );
    if (this.config.crossEffectsEnabled) {
      await this.batchProcessor.applyCrossEffectsBatch();
    }

    this.batchProcessor.syncToMap(this.entityNeeds);

    if (this._tickCounter % 10 === 0 && this.entityNeeds.size > 0) {
      const first = Array.from(this.entityNeeds.entries())[0];
      if (first) {
        const [id, n] = first;
        logger.debug(
          `[NeedsSystem] ${id}: h=${n.hunger.toFixed(0)}, t=${n.thirst.toFixed(0)}, e=${n.energy.toFixed(0)}`,
        );
      }
    }

    await this.applySocialMoraleBoostBatch(entityIdArray);

    for (const [entityId, needs] of this.entityNeeds.entries()) {
      this.consumeResourcesForNeeds(entityId, needs);

      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.emitNeedEvents(entityId, needs);
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "NeedsSystem",
      "updateBatch",
      duration,
    );
    this.dirtyTracker?.markDirty("agents");
  }

  /**
   * Consumes resources from inventory to satisfy needs.
   * Agents consume food when hungry (<70) and water when thirsty (<70).
   * Zone bonuses apply to: rest (better in houses), social/fun (markets, temples).
   * If inventory is empty, they must gather resources or trade.
   *
   * @param entityId - Entity identifier
   * @param needs - Entity needs data
   */
  private consumeResourcesForNeeds(
    entityId: string,
    needs: EntityNeedsData,
  ): void {
    if (!this.inventorySystem) return;

    const inv = this.inventorySystem.getAgentInventory(entityId);
    if (!inv) return;

    const position = this.agentRegistry?.getPosition(entityId);
    const nearbyZones = position
      ? this.findZonesNearPosition(position, 50)
      : [];

    const HUNGER_THRESHOLD = SIMULATION_CONSTANTS.NEEDS.SATISFIED_THRESHOLD;
    const HUNGER_CRITICAL = SIMULATION_CONSTANTS.NEEDS.LOW_THRESHOLD;

    const THIRST_THRESHOLD = SIMULATION_CONSTANTS.NEEDS.SATISFIED_THRESHOLD;
    const THIRST_CRITICAL = SIMULATION_CONSTANTS.NEEDS.LOW_THRESHOLD;

    if (needs.hunger < HUNGER_THRESHOLD && inv.food > 0) {
      const urgency = needs.hunger < HUNGER_CRITICAL ? 2 : 1;
      const toConsume = Math.min(urgency, inv.food);
      const removed = this.inventorySystem.removeFromAgent(
        entityId,
        ResourceType.FOOD,
        toConsume,
      );

      if (removed > 0) {
        const hungerRestore = removed * 15;
        needs.hunger = Math.min(100, needs.hunger + hungerRestore);

        logger.debug(
          `🍖 ${entityId} ate ${removed} food → hunger: ${needs.hunger.toFixed(1)}`,
        );

        simulationEvents.emit(GameEventType.RESOURCE_CONSUMED, {
          agentId: entityId,
          resourceType: ResourceType.FOOD,
          amount: removed,
          needType: NeedType.HUNGER,
          newValue: needs.hunger,
          timestamp: Date.now(),
        });
      }
    }

    if (needs.thirst < THIRST_THRESHOLD && inv.water > 0) {
      const urgency = needs.thirst < THIRST_CRITICAL ? 2 : 1;
      const toConsume = Math.min(urgency, inv.water);
      const removed = this.inventorySystem.removeFromAgent(
        entityId,
        ResourceType.WATER,
        toConsume,
      );

      if (removed > 0) {
        const thirstRestore = removed * 20;
        needs.thirst = Math.min(100, needs.thirst + thirstRestore);

        logger.debug(
          `💧 ${entityId} drank ${removed} water → thirst: ${needs.thirst.toFixed(1)}`,
        );

        simulationEvents.emit(GameEventType.RESOURCE_CONSUMED, {
          agentId: entityId,
          resourceType: ResourceType.WATER,
          amount: removed,
          needType: NeedType.THIRST,
          newValue: needs.thirst,
          timestamp: Date.now(),
        });
      }
    }

    const action = this.entityActions.get(entityId) || ActionType.IDLE;
    let baseEnergyRecovery = 0;

    if (action === ActionType.SLEEP) {
      baseEnergyRecovery = 3;
    } else if (action === ActionType.IDLE) {
      baseEnergyRecovery = 1;
    }

    let restMultiplier = 1.0;
    for (const zone of nearbyZones) {
      if (zone.type === ZoneType.SHELTER || zone.type === ZoneType.REST) {
        restMultiplier = 3.0;
        break;
      }
    }

    if (baseEnergyRecovery > 0) {
      const energyRecovery = baseEnergyRecovery * restMultiplier;
      needs.energy = Math.min(100, needs.energy + energyRecovery);
    }

    this.applyZoneBonuses(entityId, needs, nearbyZones);
  }

  /**
   * Applies zone-based bonuses for social, fun, hygiene, and mental health.
   * These needs are satisfied by being in the right zones, not by consuming items.
   */
  private applyZoneBonuses(
    _entityId: string,
    needs: EntityNeedsData,
    zones: Array<{ type: string }>,
  ): void {
    const multiplier = this.config.zoneBonusMultiplier || 1.0;

    for (const zone of zones) {
      switch (zone.type) {
        case ZoneType.HYGIENE:
        case ZoneType.BATH:
        case ZoneType.WELL: {
          const hygieneBonus = 2 * multiplier;
          needs.hygiene = Math.min(100, needs.hygiene + hygieneBonus);
          break;
        }

        case ZoneType.SOCIAL:
        case ZoneType.MARKET:
        case ZoneType.GATHERING:
        case ZoneType.TAVERN: {
          const socialBonus = 1.5 * multiplier;
          const funBonus = 1.0 * multiplier;
          needs.social = Math.min(100, needs.social + socialBonus);
          needs.fun = Math.min(100, needs.fun + funBonus);
          break;
        }

        case ZoneType.ENTERTAINMENT:
        case ZoneType.FESTIVAL: {
          const funBonus = 2.5 * multiplier;
          const mentalBonus = 1.0 * multiplier;
          needs.fun = Math.min(100, needs.fun + funBonus);
          needs.mentalHealth = Math.min(100, needs.mentalHealth + mentalBonus);
          break;
        }

        case ZoneType.TEMPLE:
        case ZoneType.SANCTUARY: {
          const mentalBonus = 2.0 * multiplier;
          const socialBonus = 0.5 * multiplier;
          needs.mentalHealth = Math.min(100, needs.mentalHealth + mentalBonus);
          needs.social = Math.min(100, needs.social + socialBonus);
          break;
        }
      }
    }
  }

  /**
   * Finds zones near a position with caching for performance.
   */
  private findZonesNearPosition(
    position: { x: number; y: number },
    radius: number,
  ): Array<{
    type: string;
    bounds: { x: number; y: number; width: number; height: number };
  }> {
    const cacheKey = `${Math.floor(position.x / 100)},${Math.floor(position.y / 100)}`;

    const cached = this.zoneCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ZONE_CACHE_TTL) {
      return cached.zones;
    }

    const zones = (this.gameState.zones || []).filter((zone) => {
      if (!zone.bounds) return false;
      const dx = zone.bounds.x + zone.bounds.width / 2 - position.x;
      const dy = zone.bounds.y + zone.bounds.height / 2 - position.y;
      return Math.sqrt(dx * dx + dy * dy) < radius + zone.bounds.width / 2;
    });

    this.zoneCache.set(cacheKey, {
      zones,
      timestamp: Date.now(),
    });

    return zones;
  }

  /**
   * Cleans expired zone cache entries.
   */
  private cleanZoneCache(now: number): void {
    for (const [key, cache] of this.zoneCache.entries()) {
      if (now - cache.timestamp > this.ZONE_CACHE_TTL) {
        this.zoneCache.delete(key);
      }
    }
  }

  private checkForDeath(entityId: string, needs: EntityNeedsData): boolean {
    if (this.respawnQueue.has(entityId)) {
      return true;
    }

    const entity = this.gameState.entities?.find((e) => e.id === entityId);
    if (entity?.isDead) {
      return true;
    }

    if (entity?.immortal) {
      if (needs.hunger <= 10) needs.hunger = 20;
      if (needs.thirst <= 10) needs.thirst = 20;
      if (needs.energy <= 10) needs.energy = 20;
      return false;
    }

    if (needs.hunger <= (this.config.deathThresholds?.[NeedType.HUNGER] ?? 0)) {
      this.handleEntityDeath(entityId, needs, "starvation");
      return true;
    }
    if (needs.thirst <= (this.config.deathThresholds?.[NeedType.THIRST] ?? 0)) {
      this.handleEntityDeath(entityId, needs, "dehydration");
      return true;
    }
    if (needs.energy <= (this.config.deathThresholds?.[NeedType.ENERGY] ?? 0)) {
      this.handleEntityDeath(entityId, needs, "exhaustion");
      return true;
    }
    return false;
  }

  /**
   * Handles entity death from needs depletion.
   * Emits AGENT_DEATH event for LifeCycleSystem to handle the actual death.
   * NeedsSystem should NOT modify isDead directly - that's LifeCycleSystem's domain.
   */
  private handleEntityDeath(
    entityId: string,
    needs: EntityNeedsData,
    cause: "starvation" | "dehydration" | "exhaustion",
  ): void {
    logger.info(`💀 Entity ${entityId} died from ${cause}`);

    simulationEvents.emit(GameEventType.AGENT_DEATH, {
      agentId: entityId,
      cause,
      needs: { ...needs },
      timestamp: Date.now(),
    });

    if (this.config.allowRespawn) {
      this.scheduleRespawn(entityId, 30000);
    } else {
      this.entityNeeds.delete(entityId);
      this.emit("entityRemoved", entityId);
    }
  }

  private scheduleRespawn(entityId: string, delayMs: number): void {
    const respawnTime = Date.now() + delayMs;
    this.respawnQueue.set(entityId, respawnTime);
  }

  private processRespawnQueue(now: number): void {
    const toRespawn: string[] = [];
    for (const [entityId, respawnTime] of this.respawnQueue) {
      if (now >= respawnTime) {
        toRespawn.push(entityId);
      }
    }
    for (const entityId of toRespawn) {
      this.respawnEntity(entityId);
      this.respawnQueue.delete(entityId);
    }
  }

  private respawnEntity(entityId: string): void {
    const needs = this.initializeEntityNeeds(entityId);
    needs.hunger = 100;
    needs.thirst = 100;
    needs.energy = 100;
    needs.hygiene = 80;
    needs.social = 70;
    needs.fun = 70;
    needs.mentalHealth = 80;

    if (this.gameState.agents) {
      const agent = this.gameState.agents.find((a) => a.id === entityId);
      if (agent) {
        agent.isDead = false;
      }
    }

    logger.info(`✨ Entity ${entityId} respawned`);

    simulationEvents.emit(GameEventType.AGENT_RESPAWNED, {
      agentId: entityId,
      timestamp: Date.now(),
    });
  }

  public setEntityNeeds(
    entityId: string,
    needs: {
      hunger: number;
      thirst: number;
      energy: number;
      social: number;
      fun: number;
      hygiene: number;
      mentalHealth: number;
    },
  ): void {
    this.entityNeeds.set(entityId, { ...needs });
  }

  private checkEmergencyNeeds(entityId: string, needs: EntityNeedsData): void {
    const CRITICAL = 20;

    if (needs.hunger < CRITICAL) {
      if (!this.tryEmergencyFood(entityId, needs)) {
        needs.hunger = Math.min(100, needs.hunger + 0.5);
      }
    }
    if (needs.thirst < CRITICAL) {
      if (!this.tryEmergencyWater(entityId, needs)) {
        needs.thirst = Math.min(100, needs.thirst + 0.5);
      }
    }
    if (needs.energy < CRITICAL) {
      this.applyEmergencyRest(entityId, needs);
    }
  }

  private tryEmergencyFood(entityId: string, needs: EntityNeedsData): boolean {
    if (this.inventorySystem) {
      const inv = this.inventorySystem.getAgentInventory(entityId);
      if (inv && inv.food > 0) {
        const consumed = Math.min(5, inv.food);
        this.inventorySystem.removeFromAgent(
          entityId,
          ResourceType.FOOD,
          consumed,
        );
        needs.hunger = Math.min(100, needs.hunger + consumed * 10);
        return true;
      }
    }
    return false;
  }

  private tryEmergencyWater(entityId: string, needs: EntityNeedsData): boolean {
    if (this.inventorySystem) {
      const inv = this.inventorySystem.getAgentInventory(entityId);
      if (inv && inv.water > 0) {
        const consumed = Math.min(5, inv.water);
        this.inventorySystem.removeFromAgent(
          entityId,
          ResourceType.WATER,
          consumed,
        );
        needs.thirst = Math.min(100, needs.thirst + consumed * 10);
        return true;
      }
    }
    return false;
  }

  private applyEmergencyRest(_entityId: string, needs: EntityNeedsData): void {
    const emergencyRest = 5;
    needs.energy = Math.min(100, needs.energy + emergencyRest);
  }

  private applyNeedDecay(
    needs: EntityNeedsData,
    deltaSeconds: number,
    entityId: string,
    action: string = ActionType.IDLE,
  ): void {
    const ageMultiplier = this.getAgeDecayMultiplier(entityId);
    const divineModifiers = this.config.decayRates;

    for (const [need, rate] of Object.entries(divineModifiers)) {
      let finalRate = rate * ageMultiplier;

      if (need === NeedType.ENERGY) {
        if (action === ActionType.SLEEP) finalRate = -5.0;
        else if (action === ActionType.IDLE) finalRate = -0.5;
        else if (action === ActionType.WORK) finalRate *= 1.5;
        else if (action === ActionType.MOVE) finalRate *= 2.0;
      }

      const key = need as keyof EntityNeedsData;
      if (typeof needs[key] === "number") {
        needs[key] = Math.max(
          0,
          Math.min(100, (needs[key] as number) - finalRate * deltaSeconds),
        );
      }
    }
  }

  private getAgeDecayMultiplier(entityId: string): number {
    if (!this.lifeCyclePort) return 1.0;
    const agent = this.lifeCyclePort.getAgent(entityId);
    if (!agent) return 1.0;

    switch (agent.lifeStage) {
      case LifeStage.CHILD:
        return 0.7;
      case LifeStage.ADULT:
        return 1.0;
      case LifeStage.ELDER:
        return 1.4;
      default:
        return 1.0;
    }
  }

  private applySocialMoraleBoost(
    entityId: string,
    needs: EntityNeedsData,
  ): void {
    if (!this.socialSystem || !this.gameState.entities) return;

    const entity = this.entityIndex?.getEntity(entityId);
    if (!entity?.position) return;

    const entityPosition = entity.position;
    const radius = 100;

    let nearbyEntities: Array<{ id: string }>;
    if (this.spatialIndex) {
      const nearbyResults = this.spatialIndex.queryRadius(
        entityPosition,
        radius,
        EntityType.AGENT,
      );
      nearbyEntities = nearbyResults
        .filter((r) => r.entity !== entityId)
        .map((r) => {
          const e = this.entityIndex?.getEntity(r.entity);
          return e ? { id: e.id } : { id: r.entity };
        });
    } else {
      const radiusSq = radius * radius;
      nearbyEntities = this.gameState.entities.filter((e) => {
        if (e.id === entityId || !e.position) return false;
        const dx = e.position.x - entityPosition.x;
        const dy = e.position.y - entityPosition.y;
        const distanceSq = dx * dx + dy * dy;
        return distanceSq <= radiusSq;
      });
    }

    if (nearbyEntities.length === 0) return;

    let totalAffinity = 0;
    let affinityCount = 0;

    for (const nearby of nearbyEntities) {
      if (!nearby.id) continue;
      const affinity = this.socialSystem.getAffinityBetween(
        entityId,
        nearby.id,
      );
      if (affinity > 0) {
        totalAffinity += affinity;
        affinityCount++;
      }
    }

    if (affinityCount > 0) {
      const avgAffinity = totalAffinity / affinityCount;

      if (avgAffinity > 0.5) {
        const boost = Math.min(0.5, avgAffinity * 0.3);
        needs.social = Math.min(100, needs.social + boost);
        needs.fun = Math.min(100, needs.fun + boost * 0.8);
      } else if (avgAffinity > 0.2) {
        const boost = avgAffinity * 0.15;
        needs.social = Math.min(100, needs.social + boost);
        needs.fun = Math.min(100, needs.fun + boost * 0.6);
      }

      if (affinityCount >= 3 && avgAffinity > 0.3) {
        needs.social = Math.min(100, needs.social + 2);
        needs.fun = Math.min(100, needs.fun + 1);
      }
    }
  }

  /**
   * Batch version of applySocialMoraleBoost using GPU for distance calculations.
   * Uses pairwise distance computation on GPU when entity count exceeds threshold.
   *
   * @param entityIds - Array of entity IDs to process
   * @returns void - Modifies entityNeeds map in place
   */
  private async applySocialMoraleBoostBatch(
    entityIds: string[],
  ): Promise<void> {
    if (!this.socialSystem || !this.gameState.entities) return;

    const GPU_BATCH_THRESHOLD = 20;

    const entityPositions: Array<{ id: string; x: number; y: number }> = [];
    for (const entityId of entityIds) {
      const entity = this.entityIndex?.getEntity(entityId);
      if (entity?.position) {
        entityPositions.push({
          id: entityId,
          x: entity.position.x,
          y: entity.position.y,
        });
      }
    }

    if (entityPositions.length < 2) return;

    const RADIUS = 100;
    const RADIUS_SQ = RADIUS * RADIUS;

    if (
      this.gpuService?.isGPUAvailable() &&
      entityPositions.length >= GPU_BATCH_THRESHOLD
    ) {
      const startTime = performance.now();
      const n = entityPositions.length;

      const positions = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        positions[i * 2] = entityPositions[i].x;
        positions[i * 2 + 1] = entityPositions[i].y;
      }

      const result = await this.gpuService.computePairwiseDistances(
        positions,
        n,
      );
      const distancesSq = result.distances;

      const getTriangleIndex = (i: number, j: number): number => {
        if (i > j) [i, j] = [j, i];
        return i * n - (i * (i + 1)) / 2 + j - i - 1;
      };

      for (let i = 0; i < n; i++) {
        const entityId = entityPositions[i].id;
        const needs = this.entityNeeds.get(entityId);
        if (!needs) continue;

        let totalAffinity = 0;
        let affinityCount = 0;

        for (let j = 0; j < n; j++) {
          if (i === j) continue;

          const idx = getTriangleIndex(i, j);
          const distSq = distancesSq[idx];
          if (distSq <= RADIUS_SQ) {
            const nearbyId = entityPositions[j].id;
            const affinity = this.socialSystem.getAffinityBetween(
              entityId,
              nearbyId,
            );
            if (affinity > 0) {
              totalAffinity += affinity;
              affinityCount++;
            }
          }
        }

        if (affinityCount > 0) {
          const avgAffinity = totalAffinity / affinityCount;

          if (avgAffinity > 0.5) {
            const boost = Math.min(0.5, avgAffinity * 0.3);
            needs.social = Math.min(100, needs.social + boost);
            needs.fun = Math.min(100, needs.fun + boost * 0.8);
          } else if (avgAffinity > 0.2) {
            const boost = avgAffinity * 0.15;
            needs.social = Math.min(100, needs.social + boost);
            needs.fun = Math.min(100, needs.fun + boost * 0.6);
          }

          if (affinityCount >= 3 && avgAffinity > 0.3) {
            needs.social = Math.min(100, needs.social + 2);
            needs.fun = Math.min(100, needs.fun + 1);
          }
        }
      }

      const duration = performance.now() - startTime;
      performanceMonitor.recordSubsystemExecution(
        "NeedsSystem",
        "applySocialMoraleBoostBatch_GPU",
        duration,
      );
      performanceMonitor.recordBatchProcessing(
        "social_morale_gpu",
        entityPositions.length,
        duration,
        true,
      );
    } else {
      for (const entityId of entityIds) {
        const needs = this.entityNeeds.get(entityId);
        if (needs) {
          this.applySocialMoraleBoost(entityId, needs);
        }
      }
    }
  }

  private applyCrossEffects(needs: EntityNeedsData): void {
    if (needs.energy < 30) {
      const penalty = (30 - needs.energy) * 0.02;
      needs.social = Math.max(0, needs.social - penalty);
      needs.fun = Math.max(0, needs.fun - penalty);
      needs.mentalHealth = Math.max(0, needs.mentalHealth - penalty * 1.5);
    }

    if (needs.hunger < 40) {
      const hungerPenalty = (40 - needs.hunger) * 0.03;
      needs.energy = Math.max(0, needs.energy - hungerPenalty);
      needs.mentalHealth = Math.max(
        0,
        needs.mentalHealth - hungerPenalty * 0.5,
      );
    }

    if (needs.thirst < 30) {
      const thirstPenalty = (30 - needs.thirst) * 0.05;
      needs.energy = Math.max(0, needs.energy - thirstPenalty * 2);
      needs.mentalHealth = Math.max(0, needs.mentalHealth - thirstPenalty);
    }
  }

  private emitNeedEvents(entityId: string, needs: EntityNeedsData): void {
    const CRITICAL = this.config.criticalThreshold;

    for (const [need, value] of Object.entries(needs)) {
      if (typeof value === "number" && value < CRITICAL) {
        simulationEvents.emit(GameEventType.NEED_CRITICAL, {
          agentId: entityId,
          need,
          value,
          timestamp: Date.now(),
        });
      }
    }

    if (needs.hunger > 90) {
      simulationEvents.emit(GameEventType.NEED_SATISFIED, {
        agentId: entityId,
        need: NeedType.HUNGER,
        value: needs.hunger,
      });
    }
  }

  /**
   * Initializes needs for a new entity (alias for initializeEntityNeeds).
   *
   * @param entityId - Entity identifier
   */
  public initializeNeeds(entityId: string): void {
    this.initializeEntityNeeds(entityId);
  }

  /**
   * Checks if an entity has any critical needs.
   *
   * @param entityId - Entity identifier
   * @returns True if any need is below criticalThreshold
   */
  public hasCriticalNeeds(entityId: string): boolean {
    const needs = this.getNeeds(entityId);
    if (!needs) return false;

    const threshold = this.config.criticalThreshold;
    return Object.values(needs).some(
      (value) => value !== undefined && value < threshold,
    );
  }

  /**
   * Initializes needs for an entity with default values (all at 100).
   *
   * @param entityId - Entity identifier
   * @returns Initialized needs data
   */
  public initializeEntityNeeds(entityId: string): EntityNeedsData {
    const needs: EntityNeedsData = {
      hunger: 100,
      thirst: 100,
      energy: 100,
      hygiene: 100,
      social: 100,
      fun: 100,
      mentalHealth: 100,
    };
    this.entityNeeds.set(entityId, needs);
    return needs;
  }

  /**
   * Gets the needs for an entity.
   *
   * @param entityId - Entity identifier
   * @returns Needs data or undefined if not found
   */
  public getNeeds(entityId: string): EntityNeedsData | undefined {
    return this.entityNeeds.get(entityId);
  }

  /**
   * Gets the needs for an entity (alias for getNeeds).
   *
   * @param entityId - Entity identifier
   * @returns Needs data or undefined if not found
   */
  public getEntityNeeds(entityId: string): EntityNeedsData | undefined {
    return this.getNeeds(entityId);
  }

  /**
   * Gets all entity needs.
   *
   * @returns Map of entity ID to needs data
   */
  public getAllNeeds(): Map<string, EntityNeedsData> {
    return this.entityNeeds;
  }

  /**
   * Removes needs for an entity.
   *
   * @param entityId - Entity identifier to remove
   */
  public removeEntityNeeds(entityId: string): void {
    this.entityNeeds.delete(entityId);
    this.respawnQueue.delete(entityId);
  }

  /**
   * Updates the needs configuration.
   *
   * @param partial - Partial configuration to merge
   */
  public updateConfig(partial: Partial<NeedsConfig>): void {
    this.config = { ...this.config, ...partial };
    this.emit("configUpdated", this.config);
  }

  /**
   * Manually recovers energy for an entity.
   * Used by AISystem when agent is resting outside of a zone (e.g. idle/field rest).
   *
   * @param entityId - Entity identifier
   * @param amount - Amount of energy to recover
   */
  public recoverEnergy(entityId: string, amount: number): void {
    const needs = this.entityNeeds.get(entityId);
    if (needs) {
      needs.energy = Math.min(100, needs.energy + amount);
    }
  }

  /**
   * Satisfies a need for an entity, increasing its value.
   *
   * @param entityId - Entity identifier
   * @param needType - Type of need to satisfy
   * @param amount - Amount to add (clamped to 0-100)
   * @returns True if need was satisfied, false if entity not found
   */
  public satisfyNeed(
    entityId: string,
    needType: string,
    amount: number,
  ): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needKey = needType as keyof EntityNeedsData;
    if (needKey in data && typeof data[needKey] === "number") {
      (data[needKey] as number) = Math.min(
        100,
        (data[needKey] as number) + amount,
      );
      return true;
    }
    return false;
  }

  /**
   * Modifies a need for an entity by a delta amount.
   *
   * @param entityId - Entity identifier
   * @param needType - Type of need to modify
   * @param delta - Amount to add/subtract (clamped to 0-100)
   * @returns True if need was modified, false if entity not found
   */
  public modifyNeed(
    entityId: string,
    needType: string,
    delta: number,
  ): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needKey = needType as keyof EntityNeedsData;
    if (needKey in data && typeof data[needKey] === "number") {
      (data[needKey] as number) = Math.max(
        0,
        Math.min(100, (data[needKey] as number) + delta),
      );
      return true;
    }
    return false;
  }

  /**
   * Aplica los efectos de una comida del catálogo a una entidad.
   * Usa FoodCatalog para obtener los efectos específicos de cada tipo de comida.
   *
   * @param entityId - ID de la entidad
   * @param foodId - ID de la comida en el catálogo
   * @returns Objeto con los cambios aplicados, o null si no se encontró la comida/entidad
   */
  public applyFoodEffects(
    entityId: string,
    foodId: string,
  ): {
    hunger: number;
    happiness: number;
    energy: number;
    health: number;
  } | null {
    const food = FoodCatalog.getFoodById(foodId);
    if (!food) return null;

    const data = this.entityNeeds.get(entityId);
    if (!data) return null;

    const changes = {
      hunger: food.hungerRestore,
      happiness: food.happinessBonus,
      energy: food.energyEffect,
      health: food.healthEffect,
    };

    data.hunger = Math.min(100, data.hunger + changes.hunger);
    data.fun = Math.min(100, data.fun + changes.happiness);
    data.energy = Math.min(100, data.energy + changes.energy);

    if (changes.health !== 0) {
      logger.debug(
        `🏥 Food health effect for ${entityId}: ${changes.health > 0 ? "+" : ""}${changes.health} `,
      );
    }

    logger.debug(
      `🍖 ${entityId} consumed ${food.name}: hunger + ${changes.hunger}, energy + ${changes.energy} `,
    );

    return changes;
  }

  /**
   * Obtiene la comida recomendada para una entidad según sus necesidades.
   * Usa FoodCatalog.getRecommendedFood().
   */
  public getRecommendedFoodForEntity(
    entityId: string,
    availableMoney: number = 100,
  ): FoodItem[] {
    const data = this.entityNeeds.get(entityId);
    if (!data) return [];

    return FoodCatalog.getRecommendedFood(
      data.hunger,
      data.fun,
      availableMoney,
    );
  }

  /**
   * Obtiene todas las comidas disponibles por categoría
   */
  public getFoodsByCategory(category: FoodCategory): FoodItem[] {
    return FoodCatalog.getFoodsByCategory(category);
  }

  /**
   * System name for ECS registration
   */
  public readonly name = "needs";

  /**
   * Request consumption of a resource or item to satisfy needs.
   * Returns HandlerResult for ECS handler compatibility.
   *
   * Flow:
   * 1. Try to consume from inventory first
   * 2. If inventory empty, try to gather from nearby world resource
   * 3. After gathering, consume the gathered resource
   */
  public requestConsume(
    agentId: string,
    itemIdOrNeedType: string,
  ): {
    status:
      | HandlerResultStatus.DELEGATED
      | HandlerResultStatus.COMPLETED
      | HandlerResultStatus.FAILED
      | HandlerResultStatus.IN_PROGRESS;
    system: string;
    message?: string;
    data?: unknown;
  } {
    const needs = this.entityNeeds.get(agentId);

    if (!needs) {
      return {
        status: HandlerResultStatus.FAILED,
        system: "needs",
        message: `No needs data for agent ${agentId}`,
      };
    }

    const needType = itemIdOrNeedType.toLowerCase();

    if (this.inventorySystem) {
      const inventory = this.inventorySystem.getAgentInventory(agentId);

      if (needType === NeedType.HUNGER || needType === ResourceType.FOOD) {
        if (inventory && inventory.food > 0) {
          this.inventorySystem.removeFromAgent(agentId, ResourceType.FOOD, 1);
          this.satisfyNeed(agentId, NeedType.HUNGER, 25);
          return {
            status: HandlerResultStatus.COMPLETED,
            system: "needs",
            message: "Consumed food from inventory",
            data: { needType: NeedType.HUNGER, restored: 25 },
          };
        }
      }

      if (needType === NeedType.THIRST || needType === ResourceType.WATER) {
        if (inventory && inventory.water > 0) {
          this.inventorySystem.removeFromAgent(agentId, ResourceType.WATER, 1);
          this.satisfyNeed(agentId, NeedType.THIRST, 25);
          return {
            status: HandlerResultStatus.COMPLETED,
            system: "needs",
            message: "Consumed water from inventory",
            data: { needType: NeedType.THIRST, restored: 25 },
          };
        }
      }

      const gatherResult = this.tryGatherFromNearbyResource(agentId, needType);
      if (gatherResult.gathered) {
        if (needType === NeedType.HUNGER || needType === ResourceType.FOOD) {
          this.inventorySystem.removeFromAgent(agentId, ResourceType.FOOD, 1);
          this.satisfyNeed(agentId, NeedType.HUNGER, 25);
          return {
            status: HandlerResultStatus.COMPLETED,
            system: "needs",
            message: `Gathered and consumed food from ${gatherResult.resourceId}`,
            data: {
              needType: NeedType.HUNGER,
              restored: 25,
              source: RestoreSource.WORLD,
            },
          };
        }
        if (needType === NeedType.THIRST || needType === ResourceType.WATER) {
          this.inventorySystem.removeFromAgent(agentId, ResourceType.WATER, 1);
          this.satisfyNeed(agentId, NeedType.THIRST, 25);
          return {
            status: HandlerResultStatus.COMPLETED,
            system: "needs",
            message: `Gathered and consumed water from ${gatherResult.resourceId}`,
            data: {
              needType: NeedType.THIRST,
              restored: 25,
              source: RestoreSource.WORLD,
            },
          };
        }
      }
    }

    return {
      status: HandlerResultStatus.FAILED,
      system: "needs",
      message: `No consumable available for ${itemIdOrNeedType}`,
    };
  }

  /**
   * Try to gather resources from a nearby world resource OR water tile.
   * Used when agent inventory is empty but agent is near a resource source.
   *
   * For water (thirst): Uses WorldQueryService to find OCEAN tiles directly.
   * The agent drinks from the terrain tile - no resource object needed.
   */
  private tryGatherFromNearbyResource(
    agentId: string,
    needType: string,
  ): { gathered: boolean; resourceId?: string } {
    const agent = this.gameState.agents?.find((a) => a.id === agentId);
    if (!agent || !agent.position) {
      return { gathered: false };
    }

    const agentPos = { x: agent.position.x, y: agent.position.y };
    // Increased from 50 to 100 to cover at least 1.5 tiles (64px = 1 tile)
    const GATHER_RANGE = 100;

    // For THIRST: Search for OCEAN/LAKE tiles using WorldQueryService
    if (needType === NeedType.THIRST || needType === ResourceType.WATER) {
      if (this.worldQueryService) {
        const waterTiles = this.worldQueryService.findWaterTilesNear(
          agentPos.x,
          agentPos.y,
          GATHER_RANGE,
        );

        logger.debug(
          `[NeedsSystem] 🔍 ${agentId} at (${agentPos.x.toFixed(0)}, ${agentPos.y.toFixed(0)}) searching water r=${GATHER_RANGE}: found ${waterTiles.length} tiles`,
        );

        if (waterTiles.length > 0) {
          const nearestTile = waterTiles[0]; // Already sorted by distance

          // Consume water from tile - may convert OCEAN to DIRT if depleted
          if (this.terrainSystem) {
            const consumed = this.terrainSystem.consumeWaterFromTile(
              nearestTile.tileX,
              nearestTile.tileY,
            );

            if (consumed > 0) {
              logger.info(
                `[NeedsSystem] 💧 Agent ${agentId} drinking from OCEAN tile at (${nearestTile.worldX}, ${nearestTile.worldY}), consumed ${consumed} water`,
              );

              // Add water to inventory then consume it
              if (this.inventorySystem) {
                this.inventorySystem.addResource(
                  agentId,
                  ResourceType.WATER,
                  1,
                );
              }
              return {
                gathered: true,
                resourceId: `ocean_tile_${nearestTile.tileX}_${nearestTile.tileY}`,
              };
            }
          } else {
            // Fallback without TerrainSystem - just drink without consuming tile
            logger.info(
              `[NeedsSystem] 💧 Agent ${agentId} drinking from OCEAN tile at (${nearestTile.worldX}, ${nearestTile.worldY})`,
            );

            if (this.inventorySystem) {
              this.inventorySystem.addResource(agentId, ResourceType.WATER, 1);
            }
            return {
              gathered: true,
              resourceId: `ocean_tile_${nearestTile.tileX}_${nearestTile.tileY}`,
            };
          }
        }
      }

      // Fallback: check for water resources if WorldQueryService unavailable
      if (this.gameState?.worldResources && this.inventorySystem) {
        const targetTypes = ["water_source", ResourceType.WATER, "water_fresh"];
        let nearestResource: { id: string; distance: number } | null = null;

        for (const [resourceId, resource] of Object.entries(
          this.gameState.worldResources,
        )) {
          if (
            !resource ||
            !targetTypes.includes(resource.type?.toLowerCase() || "")
          ) {
            continue;
          }

          const resPos = resource.position || { x: 0, y: 0 };
          const dx = resPos.x - agentPos.x;
          const dy = resPos.y - agentPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (
            distance <= GATHER_RANGE &&
            (!nearestResource || distance < nearestResource.distance)
          ) {
            nearestResource = { id: resourceId, distance };
          }
        }

        if (nearestResource) {
          const gatherResult = this.inventorySystem.requestGather(
            agentId,
            nearestResource.id,
            1,
          );
          if (gatherResult.status === HandlerResultStatus.COMPLETED) {
            logger.info(
              `[NeedsSystem] 🚰 Agent ${agentId} gathered water from ${nearestResource.id}`,
            );
            return { gathered: true, resourceId: nearestResource.id };
          }
        }
      }

      return { gathered: false };
    }

    // For HUNGER: Search for food resources
    if (!this.gameState?.worldResources || !this.inventorySystem) {
      return { gathered: false };
    }

    const targetTypes = ["food_source", "berry_bush", "food"];
    let nearestResource: { id: string; distance: number } | null = null;

    for (const [resourceId, resource] of Object.entries(
      this.gameState.worldResources,
    )) {
      if (
        !resource ||
        !targetTypes.includes(resource.type?.toLowerCase() || "")
      ) {
        continue;
      }

      const resPos = resource.position || { x: 0, y: 0 };
      const dx = resPos.x - agentPos.x;
      const dy = resPos.y - agentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= GATHER_RANGE) {
        if (!nearestResource || distance < nearestResource.distance) {
          nearestResource = { id: resourceId, distance };
        }
      }
    }

    if (nearestResource) {
      logger.debug(
        `[NeedsSystem] ${agentId} found resource ${nearestResource.id} at distance ${nearestResource.distance.toFixed(1)}, attempting gather`,
      );
      const gatherResult = this.inventorySystem.requestGather(
        agentId,
        nearestResource.id,
        1,
      );

      if (gatherResult.status === HandlerResultStatus.COMPLETED) {
        logger.info(
          `[NeedsSystem] 🍎 Agent ${agentId} gathered food from ${nearestResource.id}`,
        );
        return { gathered: true, resourceId: nearestResource.id };
      } else {
        logger.debug(
          `[NeedsSystem] ${agentId} gather failed: ${gatherResult.status} - ${gatherResult.message}`,
        );
      }
    }

    return { gathered: false };
  }

  /**
   * Request rest to restore energy.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestRest(agentId: string): {
    status:
      | HandlerResultStatus.DELEGATED
      | HandlerResultStatus.COMPLETED
      | HandlerResultStatus.FAILED
      | HandlerResultStatus.IN_PROGRESS;
    system: string;
    message?: string;
    data?: unknown;
  } {
    const needs = this.entityNeeds.get(agentId);

    if (!needs) {
      return {
        status: HandlerResultStatus.FAILED,
        system: "needs",
        message: `No needs data for agent ${agentId}`,
      };
    }

    const energyBefore = needs.energy;
    this.satisfyNeed(agentId, NeedType.ENERGY, 10);
    const energyAfter = needs.energy;

    if (energyAfter >= 80) {
      return {
        status: HandlerResultStatus.COMPLETED,
        system: "needs",
        message: "Fully rested",
        data: { energy: energyAfter },
      };
    }

    return {
      status: HandlerResultStatus.IN_PROGRESS,
      system: "needs",
      message: "Resting",
      data: {
        energyBefore,
        energyAfter,
        restored: energyAfter - energyBefore,
      },
    };
  }

  /**
   * Apply a need change by delta amount.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public applyNeedChange(
    agentId: string,
    need: string,
    delta: number,
  ): {
    status:
      | HandlerResultStatus.DELEGATED
      | HandlerResultStatus.COMPLETED
      | HandlerResultStatus.FAILED
      | HandlerResultStatus.IN_PROGRESS;
    system: string;
    message?: string;
    data?: unknown;
  } {
    const success = this.modifyNeed(agentId, need, delta);

    if (success) {
      const needs = this.entityNeeds.get(agentId);
      return {
        status: HandlerResultStatus.COMPLETED,
        system: "needs",
        message: `Applied ${delta > 0 ? "+" : ""}${delta} to ${need}`,
        data: {
          need,
          delta,
          newValue: needs?.[need as keyof EntityNeedsData],
        },
      };
    }

    return {
      status: HandlerResultStatus.FAILED,
      system: "needs",
      message: `Failed to apply need change for ${agentId}`,
    };
  }

  private static readonly THRESHOLDS = {
    CRITICAL: 15,
    URGENT: 30,
    LOW: 50,
  } as const;

  private static readonly PRIORITIES = {
    CRITICAL: 0.95,
    URGENT: 0.8,
    HIGH: 0.6,
    NORMAL: 0.4,
    LOW: 0.2,
  } as const;

  /**
   * Generates pending tasks based on agent's need state.
   * This is the SINGLE SOURCE OF TRUTH for need-based task generation.
   * Detectors should call this instead of reimplementing threshold logic.
   *
   * @param agentId - The agent to check
   * @param spatialContext - Optional spatial context for target positions
   * @returns Array of task descriptors ready to be converted to full tasks
   */
  public getPendingTasks(
    agentId: string,
    spatialContext?: {
      nearestFood?: { id: string; x: number; y: number };
      nearestWater?: { id: string; x: number; y: number };
      nearbyAgents?: readonly { id: string; x: number; y: number }[];
    },
  ): Array<{
    type: string;
    priority: number;
    target?: { entityId?: string; position?: { x: number; y: number } };
    params?: Record<string, unknown>;
    source: string;
  }> {
    const needs = this.entityNeeds.get(agentId);
    if (!needs) return [];

    const tasks: Array<{
      type: string;
      priority: number;
      target?: { entityId?: string; position?: { x: number; y: number } };
      params?: Record<string, unknown>;
      source: string;
    }> = [];

    if (needs.hunger < NeedsSystem.THRESHOLDS.LOW) {
      const priority = this.calculatePriority(needs.hunger);
      tasks.push({
        type: GoalType.SATISFY_NEED,
        priority,
        target: spatialContext?.nearestFood
          ? {
              entityId: spatialContext.nearestFood.id,
              position: {
                x: spatialContext.nearestFood.x,
                y: spatialContext.nearestFood.y,
              },
            }
          : undefined,
        params: { needType: NeedType.HUNGER, resourceType: ResourceType.FOOD },
        source: "needs:hunger",
      });
    }

    if (needs.thirst < NeedsSystem.THRESHOLDS.LOW) {
      const priority = this.calculatePriority(needs.thirst);
      tasks.push({
        type: GoalType.SATISFY_NEED,
        priority,
        target: spatialContext?.nearestWater
          ? {
              entityId: spatialContext.nearestWater.id,
              position: {
                x: spatialContext.nearestWater.x,
                y: spatialContext.nearestWater.y,
              },
            }
          : undefined,
        params: { needType: NeedType.THIRST, resourceType: ResourceType.WATER },
        source: "needs:thirst",
      });
    }

    if (needs.energy < NeedsSystem.THRESHOLDS.LOW) {
      const priority = this.calculatePriority(needs.energy);
      tasks.push({
        type: ZoneType.REST,
        priority,
        params: { needType: NeedType.ENERGY, duration: 5000 },
        source: "needs:energy",
      });
    }

    if (
      needs.social < NeedsSystem.THRESHOLDS.LOW &&
      spatialContext?.nearbyAgents?.length
    ) {
      const target = spatialContext.nearbyAgents[0];
      tasks.push({
        type: ActionType.SOCIALIZE,
        priority: this.calculateSocialPriority(needs.social),
        target: { entityId: target.id, position: { x: target.x, y: target.y } },
        params: { needType: NeedType.SOCIAL },
        source: "needs:social",
      });
    }

    if (
      needs.fun < NeedsSystem.THRESHOLDS.LOW &&
      spatialContext?.nearbyAgents?.length
    ) {
      const target = spatialContext.nearbyAgents[0];
      tasks.push({
        type: ActionType.SOCIALIZE,
        priority: this.calculateSocialPriority(needs.fun) * 0.9,
        target: { entityId: target.id, position: { x: target.x, y: target.y } },
        params: { needType: NeedType.FUN, action: ZoneType.PLAY },
        source: "needs:fun",
      });
    }

    if (needs.mentalHealth < NeedsSystem.THRESHOLDS.LOW) {
      tasks.push({
        type: ZoneType.REST,
        priority: this.calculateSocialPriority(needs.mentalHealth),
        params: { needType: NeedType.MENTAL_HEALTH, action: "meditate" },
        source: "needs:mental",
      });
    }

    return tasks;
  }

  /**
   * Calculate priority based on need level
   */
  private calculatePriority(value: number): number {
    if (value < NeedsSystem.THRESHOLDS.CRITICAL)
      return NeedsSystem.PRIORITIES.CRITICAL;
    if (value < NeedsSystem.THRESHOLDS.URGENT)
      return NeedsSystem.PRIORITIES.URGENT;
    return NeedsSystem.PRIORITIES.HIGH;
  }

  /**
   * Calculate priority for social needs (less urgent)
   */
  private calculateSocialPriority(value: number): number {
    if (value < NeedsSystem.THRESHOLDS.CRITICAL)
      return NeedsSystem.PRIORITIES.HIGH;
    if (value < NeedsSystem.THRESHOLDS.URGENT)
      return NeedsSystem.PRIORITIES.NORMAL;
    return NeedsSystem.PRIORITIES.LOW;
  }
}
