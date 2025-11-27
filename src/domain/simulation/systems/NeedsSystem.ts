import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import { EntityNeedsData, NeedsConfig } from "../../types/simulation/needs";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "@/infrastructure/utils/logger";
import type { ILifeCyclePort } from "../ports";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import { NeedsBatchProcessor } from "./NeedsBatchProcessor";
import { injectable, inject, unmanaged, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";
import type { SharedSpatialIndex } from "../core/SharedSpatialIndex";
import type { GPUComputeService } from "../core/GPUComputeService";
import type { AgentRegistry } from "../core/AgentRegistry";
import { getFrameTime } from "../../../shared/FrameTime";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";
import { FoodCatalog } from "../../../simulation/data/FoodCatalog";
import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { NeedType } from "../../../shared/constants/AIEnums";
import { LifeStage } from "../../../shared/constants/AgentEnums";
import { ActionType } from "../../../shared/constants/AIEnums";
import { EntityType } from "../../../shared/constants/EntityEnums";
import { FoodCategory } from "../../../shared/constants/FoodEnums";
import type { FoodItem } from "../../types/simulation/food";

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
export class NeedsSystem extends EventEmitter {
  private gameState: GameState;
  private config: NeedsConfig;
  private entityNeeds: Map<string, EntityNeedsData>;
  private lastUpdate: number = 0;

  private lifeCyclePort?: ILifeCyclePort;
  private divineFavorSystem?: DivineFavorSystem;
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

  private entityActions = new Map<string, string>();

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @unmanaged() config?: Partial<NeedsConfig>,
    @unmanaged()
    systems?: {
      lifeCyclePort?: ILifeCyclePort;
      divineFavorSystem?: DivineFavorSystem;
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
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.spatialIndex = spatialIndex;
    this.gpuService = gpuService;
    this.agentRegistry = agentRegistry;
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
      criticalThreshold: 20,
      emergencyThreshold: 10,
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

    // Register entityNeeds Map in AgentRegistry for unified access
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
      this.divineFavorSystem = systems.divineFavorSystem;
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
    divineFavorSystem?: DivineFavorSystem;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
  }): void {
    if (systems.lifeCyclePort) this.lifeCyclePort = systems.lifeCyclePort;
    if (systems.divineFavorSystem)
      this.divineFavorSystem = systems.divineFavorSystem;
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

    // Debug: log current entityNeeds state and list all entities (periodic)
    if (this.entityNeeds.size > 0 && this._tickCounter === 0) {
      const entityIds = Array.from(this.entityNeeds.keys()).join(", ");
      logger.debug(
        `🔍 NeedsSystem state: ${this.entityNeeds.size} entities: [${entityIds}]`,
      );
    }

    for (const agent of agents) {
      if (agent.isDead) continue;

      if (!this.entityNeeds.has(agent.id)) {
        this.initializeEntityNeeds(agent.id);
        syncCount++;
        logger.debug(
          `🔄 NeedsSystem auto-initialized needs for existing agent ${agent.name} (${agent.id})`,
        );
      } else {
        // Check for corrupted needs (values stuck at 0 or near 0)
        const needs = this.entityNeeds.get(agent.id);
        if (
          needs &&
          needs.hunger === 0 &&
          needs.thirst === 0 &&
          needs.energy <= 1
        ) {
          // Reinitialize corrupted needs
          this.initializeEntityNeeds(agent.id);
          reinitCount++;
          logger.warn(
            `🔧 NeedsSystem re-initialized corrupted needs for ${agent.name} (${agent.id})`,
          );
        }
      }
    }

    if (syncCount > 0 || reinitCount > 0) {
      logger.info(
        `🔄 NeedsSystem: synced=${syncCount}, reinit=${reinitCount}, total=${agents.length}`,
      );
    }
  }

  /**
   * Updates the needs system, processing all entity needs.
   * Uses batch processing if entity count >= BATCH_THRESHOLD.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (uses config interval)
   */
  public update(_deltaTimeMs: number): void {
    const now = getFrameTime();

    this.processRespawnQueue(now);

    this.syncNeedsWithAgents();

    // Clean zone cache periodically
    this._tickCounter = (this._tickCounter || 0) + 1;
    if (this._tickCounter >= 100) {
      this.cleanZoneCache(now);
      this._tickCounter = 0;
    }

    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }

    const dtSeconds = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (this.entityNeeds.size >= this.BATCH_THRESHOLD) {
      this.updateBatch(dtSeconds, now);
    } else {
      this.updateTraditional(dtSeconds, now);
    }
  }

  private updateTraditional(dtSeconds: number, _now: number): void {
    const startTime = performance.now();
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
  }

  private updateBatch(dtSeconds: number, _now: number): void {
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

      if (this.divineFavorSystem) {
        const favorObj = this.divineFavorSystem.getFavor(entityId);
        if (favorObj) {
          divineModifiers[i] = 1 - favorObj.favor * 0.3;
        } else {
          divineModifiers[i] = 1.0;
        }
      } else {
        divineModifiers[i] = 1.0;
      }
    }

    this.batchProcessor.applyDecayBatch(
      decayRates,
      ageMultipliers,
      divineModifiers,
      dtSeconds,
    );
    if (this.config.crossEffectsEnabled) {
      this.batchProcessor.applyCrossEffectsBatch();
    }

    this.batchProcessor.syncToMap(this.entityNeeds);

    this.applySocialMoraleBoostBatch(entityIdArray);

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

    // Get position for zone bonuses
    const position = this.getEntityPosition(entityId);
    const nearbyZones = position
      ? this.findZonesNearPosition(position, 50)
      : [];

    // Hunger thresholds for eating
    const HUNGER_THRESHOLD = 70; // Start eating when below this
    const HUNGER_CRITICAL = 30; // Eat more urgently

    // Thirst thresholds for drinking
    const THIRST_THRESHOLD = 70;
    const THIRST_CRITICAL = 30;

    // Consume food when hungry (REQUIRES ITEMS)
    if (needs.hunger < HUNGER_THRESHOLD && inv.food > 0) {
      const urgency = needs.hunger < HUNGER_CRITICAL ? 2 : 1;
      const toConsume = Math.min(urgency, inv.food);
      const removed = this.inventorySystem.removeFromAgent(
        entityId,
        ResourceType.FOOD,
        toConsume,
      );

      if (removed > 0) {
        // 1 food = 15 hunger points
        const hungerRestore = removed * 15;
        needs.hunger = Math.min(100, needs.hunger + hungerRestore);

        logger.debug(
          `🍖 ${entityId} ate ${removed} food → hunger: ${needs.hunger.toFixed(1)}`,
        );

        simulationEvents.emit(GameEventNames.RESOURCE_CONSUMED, {
          agentId: entityId,
          resourceType: "food",
          amount: removed,
          needType: "hunger",
          newValue: needs.hunger,
          timestamp: Date.now(),
        });
      }
    }

    // Consume water when thirsty (REQUIRES ITEMS)
    if (needs.thirst < THIRST_THRESHOLD && inv.water > 0) {
      const urgency = needs.thirst < THIRST_CRITICAL ? 2 : 1;
      const toConsume = Math.min(urgency, inv.water);
      const removed = this.inventorySystem.removeFromAgent(
        entityId,
        ResourceType.WATER,
        toConsume,
      );

      if (removed > 0) {
        // 1 water = 20 thirst points
        const thirstRestore = removed * 20;
        needs.thirst = Math.min(100, needs.thirst + thirstRestore);

        logger.debug(
          `💧 ${entityId} drank ${removed} water → thirst: ${needs.thirst.toFixed(1)}`,
        );

        simulationEvents.emit(GameEventNames.RESOURCE_CONSUMED, {
          agentId: entityId,
          resourceType: "water",
          amount: removed,
          needType: "thirst",
          newValue: needs.thirst,
          timestamp: Date.now(),
        });
      }
    }

    // Energy recovery based on action and ZONE BONUSES
    const action = this.entityActions.get(entityId) || ActionType.IDLE;
    let baseEnergyRecovery = 0;

    if (action === ActionType.SLEEP) {
      baseEnergyRecovery = 3;
    } else if (action === ActionType.IDLE) {
      baseEnergyRecovery = 1;
    }

    // Zone multipliers for rest - resting in a house/bed is much better
    let restMultiplier = 1.0;
    for (const zone of nearbyZones) {
      if (zone.type === ZoneType.SHELTER || zone.type === ZoneType.REST) {
        restMultiplier = 3.0; // 3x faster rest in proper shelter
        break;
      }
    }

    if (baseEnergyRecovery > 0) {
      const energyRecovery = baseEnergyRecovery * restMultiplier;
      needs.energy = Math.min(100, needs.energy + energyRecovery);
    }

    // ZONE BONUSES for social needs (don't require items)
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
        // Hygiene zones
        case ZoneType.HYGIENE:
        case ZoneType.BATH:
        case ZoneType.WELL: {
          const hygieneBonus = 2 * multiplier;
          needs.hygiene = Math.min(100, needs.hygiene + hygieneBonus);
          break;
        }

        // Social zones - gain social and fun by being here
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

        // Entertainment zones
        case ZoneType.ENTERTAINMENT:
        case ZoneType.FESTIVAL: {
          const funBonus = 2.5 * multiplier;
          const mentalBonus = 1.0 * multiplier;
          needs.fun = Math.min(100, needs.fun + funBonus);
          needs.mentalHealth = Math.min(100, needs.mentalHealth + mentalBonus);
          break;
        }

        // Spiritual zones
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
   * Gets an entity's position from gameState.
   */
  private getEntityPosition(
    entityId: string,
  ): { x: number; y: number } | undefined {
    const agent = this.gameState.agents?.find((e) => e.id === entityId);
    if (agent?.position) return agent.position;

    const entity = this.gameState.entities?.find((e) => e.id === entityId);
    return entity?.position;
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

  private handleEntityDeath(
    entityId: string,
    needs: EntityNeedsData,
    cause: "starvation" | "dehydration" | "exhaustion",
  ): void {
    logger.info(`💀 Entity ${entityId} died from ${cause}`);

    let entityMarked = false;
    if (this.gameState.entities) {
      const entity =
        this.entityIndex?.getEntity(entityId) ??
        this.gameState.entities.find((e) => e.id === entityId);
      if (entity) {
        entity.isDead = true;
        entityMarked = true;
      }
    }

    if (this.gameState.agents) {
      const agent = this.getAgentFast(entityId);
      if (agent) {
        agent.isDead = true;
        entityMarked = true;
      }
    }

    if (!entityMarked) {
      logger.warn(
        `⚠️ [NEEDS] Could not mark entity ${entityId} as dead - not found in state`,
      );
    }

    simulationEvents.emit(GameEventNames.AGENT_DEATH, {
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

    if (this.gameState.entities) {
      const entity =
        this.entityIndex?.getEntity(entityId) ??
        this.gameState.entities.find((e) => e.id === entityId);
      if (entity) {
        entity.isDead = false;
      }
    }

    logger.info(`✨ Entity ${entityId} respawned`);

    simulationEvents.emit(GameEventNames.AGENT_RESPAWNED, {
      agentId: entityId,
      timestamp: Date.now(),
    });
  }

  private checkEmergencyNeeds(entityId: string, needs: EntityNeedsData): void {
    const CRITICAL = 20; // Increased from 10

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
    const emergencyRest = 5; // Increased from 2
    needs.energy = Math.min(100, needs.energy + emergencyRest);
  }

  private applyNeedDecay(
    needs: EntityNeedsData,
    deltaSeconds: number,
    entityId: string,
    action: string = ActionType.IDLE,
  ): void {
    const ageMultiplier = this.getAgeDecayMultiplier(entityId);
    const divineModifiers = this.applyDivineFavorModifiers(
      entityId,
      this.config.decayRates,
    );

    for (const [need, rate] of Object.entries(divineModifiers)) {
      let finalRate = rate * ageMultiplier;

      if (need === NeedType.ENERGY) {
        if (action === ActionType.SLEEP)
          finalRate = -5.0; // Recover energy fast
        else if (action === ActionType.IDLE)
          finalRate = -0.5; // Recover energy slowly
        else if (action === ActionType.WORK)
          finalRate *= 1.5; // Work consumes more energy
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

  private applyDivineFavorModifiers(
    entityId: string,
    decayRates: Record<string, number>,
  ): Record<string, number> {
    if (!this.divineFavorSystem) return decayRates;
    const favorObj = this.divineFavorSystem.getFavor(entityId);
    if (!favorObj) return decayRates;
    const favorValue = favorObj.favor;
    const modifier = 1 - favorValue * 0.3;

    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(decayRates)) {
      result[key] = val * modifier;
    }
    return result;
  }

  private applySocialMoraleBoost(
    entityId: string,
    needs: EntityNeedsData,
  ): void {
    if (!this.socialSystem || !this.gameState.entities) return;

    const entity =
      this.entityIndex?.getEntity(entityId) ??
      this.gameState.entities.find((e) => e.id === entityId);
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
  private applySocialMoraleBoostBatch(entityIds: string[]): void {
    if (!this.socialSystem || !this.gameState.entities) return;

    const GPU_BATCH_THRESHOLD = 20; // Use GPU when we have ≥20 entities (O(N²) operation)

    const entityPositions: Array<{ id: string; x: number; y: number }> = [];
    for (const entityId of entityIds) {
      const entity =
        this.entityIndex?.getEntity(entityId) ??
        this.gameState.entities.find((e) => e.id === entityId);
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

      const result = this.gpuService.computePairwiseDistances(positions, n);
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
        simulationEvents.emit(GameEventNames.NEED_CRITICAL, {
          agentId: entityId,
          need,
          value,
          timestamp: Date.now(),
        });
      }
    }

    if (needs.hunger > 90) {
      simulationEvents.emit(GameEventNames.NEED_SATISFIED, {
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

    // Aplicar efectos de la comida
    const changes = {
      hunger: food.hungerRestore,
      happiness: food.happinessBonus,
      energy: food.energyEffect,
      health: food.healthEffect,
    };

    data.hunger = Math.min(100, data.hunger + changes.hunger);
    data.fun = Math.min(100, data.fun + changes.happiness); // happiness -> fun
    data.energy = Math.min(100, data.energy + changes.energy);
    // health effect no está en EntityNeedsData, pero podemos emitir evento

    // Si hay efecto de salud, lo procesamos via el logger (el sistema de salud escuchará)
    if (changes.health !== 0) {
      logger.debug(
        `🏥 Food health effect for ${entityId}: ${changes.health > 0 ? "+" : ""}${changes.health}`,
      );
    }

    logger.debug(
      `🍖 ${entityId} consumed ${food.name}: hunger+${changes.hunger}, energy+${changes.energy}`,
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
   * Gets agent profile with O(1) lookup using AgentRegistry or fallback
   */
  private getAgentFast(
    agentId: string,
  ): import("../../types/simulation/agents").AgentProfile | undefined {
    // Try AgentRegistry first (O(1))
    if (this.agentRegistry) {
      const profile = this.agentRegistry.getProfile(agentId);
      if (profile) return profile;
    }
    // Try EntityIndex (O(1))
    if (this.entityIndex) {
      const agent = this.entityIndex.getAgent(agentId);
      if (agent) return agent;
    }
    // Fallback to gameState.agents.find (O(n)) - should rarely happen
    return this.gameState.agents?.find((a) => a.id === agentId);
  }
}
