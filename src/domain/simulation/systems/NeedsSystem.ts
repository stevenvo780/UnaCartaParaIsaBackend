import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import { EntityNeedsData, NeedsConfig } from "../../types/simulation/needs";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "@/infrastructure/utils/logger";
import type { ILifeCyclePort } from "../ports";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { Zone } from "../../types/game-types";
import { NeedsBatchProcessor } from "./NeedsBatchProcessor";
import { injectable, inject, unmanaged, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";
import type { SharedSpatialIndex } from "../core/SharedSpatialIndex";
import type { GPUComputeService } from "../core/GPUComputeService";
import { getFrameTime } from "../../../shared/FrameTime";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";

/**
 * System for managing entity needs (hunger, thirst, energy, hygiene, social, fun, mental health).
 *
 * Features:
 * - Decay rates configurable per need type
 * - Cross-effects between needs (e.g., low energy affects social needs)
 * - Zone-based bonuses when entities are in appropriate zones
 * - Social morale boost from nearby friendly entities
 * - Emergency auto-satisfaction when needs are critical
 * - Batch processing for performance with many entities
 * - Age-based decay multipliers (children decay slower, elders faster)
 * - Divine favor modifiers to reduce decay
 *
 * Uses NeedsBatchProcessor for vectorized operations when entity count >= 20.
 *
 * @see NeedsBatchProcessor for batch processing implementation
 * @see GPUComputeService for GPU-accelerated needs decay
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

  private zoneCache = new Map<string, { zones: Zone[]; timestamp: number }>();
  private readonly ZONE_CACHE_TTL = 15000;
  private _tickCounter = 0;

  private batchProcessor: NeedsBatchProcessor;
  /**
   * Threshold for activating batch processing.
   * 5 entities: GPU batch is efficient even with small counts due to vectorization.
   * NeedsSystem processes 7 needs per entity, so 5 entities = 35 operations.
   */
  private readonly BATCH_THRESHOLD = 5;
  private entityIndex?: EntityIndex;
  private spatialIndex?: SharedSpatialIndex;

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
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.spatialIndex = spatialIndex;
    this.config = {
      decayRates: {
        hunger: 1.0,
        thirst: 1.5,
        energy: 0.5,
        hygiene: 0.3,
        social: 0.4,
        fun: 0.4,
        mentalHealth: 0.2,
      },
      criticalThreshold: 20,
      emergencyThreshold: 10,
      updateIntervalMs: 1000,
      allowRespawn: true,
      deathThresholds: {
        hunger: 0,
        thirst: 0,
        energy: 0,
      },
      zoneBonusMultiplier: 1.0,
      crossEffectsEnabled: true,
      ...config,
    };

    this.entityNeeds = new Map();
    this.batchProcessor = new NeedsBatchProcessor(gpuService);
    if (gpuService?.isGPUAvailable()) {
      logger.info("🧠 NeedsSystem: GPU acceleration enabled for batch processing");
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
   * Updates the needs system, processing all entity needs.
   * Uses batch processing if entity count >= BATCH_THRESHOLD.
   *
   * @param _deltaTimeMs - Elapsed time in milliseconds (uses config interval)
   */
  public update(_deltaTimeMs: number): void {
    const now = getFrameTime();

    this.processRespawnQueue(now);

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
      const action = this.entityActions.get(entityId) || "idle";
      this.applyNeedDecay(needs, dtSeconds, entityId, action);
      this.handleZoneBenefits(entityId, needs, dtSeconds);
      this.applySocialMoraleBoost(entityId, needs);

      if (this.config.crossEffectsEnabled) {
        this.applyCrossEffects(needs);
      }

      // Check death BEFORE emergency needs to prevent zombi states
      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.checkEmergencyNeeds(entityId, needs);
      this.emitNeedEvents(entityId, needs);
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

    for (const [entityId, needs] of this.entityNeeds.entries()) {
      this.handleZoneBenefits(entityId, needs, dtSeconds);
      this.applySocialMoraleBoost(entityId, needs);

      // Check death BEFORE emergency needs (consistent with updateTraditional)
      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.checkEmergencyNeeds(entityId, needs);
      this.emitNeedEvents(entityId, needs);
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "NeedsSystem",
      "updateBatch",
      duration,
    );
  }

  private handleZoneBenefits(
    entityId: string,
    needs: EntityNeedsData,
    deltaSeconds: number,
  ): void {
    let position: { x: number; y: number } | undefined;
    const agent = this.gameState.agents?.find((e) => e.id === entityId);
    if (agent?.position) {
      position = agent.position;
    } else {
      const entity = this.gameState.entities?.find((e) => e.id === entityId);
      if (entity?.position) {
        position = entity.position;
      }
    }
    if (!position) return;

    const nearbyZones = this.findZonesNearPosition(position, 50);

    for (const zone of nearbyZones) {
      const multiplier = this.config.zoneBonusMultiplier || 1.0;

      switch (zone.type) {
        case "food":
        case "kitchen": {
          const hungerBonus = 15 * deltaSeconds * multiplier;
          needs.hunger = Math.min(100, needs.hunger + hungerBonus);
          break;
        }

        case "water":
        case "well": {
          const thirstBonus = 20 * deltaSeconds * multiplier;
          needs.thirst = Math.min(100, needs.thirst + thirstBonus);
          break;
        }

        case "rest":
        case "bed":
        case "shelter":
        case "house": {
          // Much faster recovery in proper shelter (approx 4x faster than base)
          const energyBonus = 50 * deltaSeconds * multiplier;
          needs.energy = Math.min(100, needs.energy + energyBonus);
          break;
        }

        case "hygiene":
        case "bath": {
          const hygieneBonus = 25 * deltaSeconds * multiplier;
          needs.hygiene = Math.min(100, needs.hygiene + hygieneBonus);
          break;
        }

        case "social":
        case "market":
        case "gathering": {
          const socialBonus = 8 * deltaSeconds * multiplier;
          const funBonus = 10 * deltaSeconds * multiplier;
          needs.social = Math.min(100, needs.social + socialBonus);
          needs.fun = Math.min(100, needs.fun + funBonus);
          break;
        }

        case "entertainment":
        case "festival": {
          const entertainmentBonus = 20 * deltaSeconds * multiplier;
          needs.fun = Math.min(100, needs.fun + entertainmentBonus);
          needs.mentalHealth = Math.min(
            100,
            needs.mentalHealth + entertainmentBonus * 0.5,
          );
          break;
        }

        case "temple":
        case "sanctuary": {
          const mentalBonus = 15 * deltaSeconds * multiplier;
          needs.mentalHealth = Math.min(100, needs.mentalHealth + mentalBonus);
          needs.social = Math.min(100, needs.social + mentalBonus * 0.3);
          break;
        }
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

    if (needs.hunger <= (this.config.deathThresholds?.hunger ?? 0)) {
      this.handleEntityDeath(entityId, needs, "starvation");
      return true;
    }
    if (needs.thirst <= (this.config.deathThresholds?.thirst ?? 0)) {
      this.handleEntityDeath(entityId, needs, "dehydration");
      return true;
    }
    if (needs.energy <= (this.config.deathThresholds?.energy ?? 0)) {
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

    if (this.gameState.entities) {
      const entity =
        this.entityIndex?.getEntity(entityId) ??
        this.gameState.entities.find((e) => e.id === entityId);
      if (entity) {
        entity.isDead = true;
      }
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
    const CRITICAL = this.config.emergencyThreshold || 10;

    if (needs.hunger < CRITICAL) {
      this.tryEmergencyFood(entityId, needs);
    }
    if (needs.thirst < CRITICAL) {
      this.tryEmergencyWater(entityId, needs);
    }
    if (needs.energy < CRITICAL) {
      this.applyEmergencyRest(entityId, needs);
    }
  }

  private tryEmergencyFood(entityId: string, needs: EntityNeedsData): void {
    if (this.inventorySystem) {
      const inv = this.inventorySystem.getAgentInventory(entityId);
      if (inv && inv.food > 0) {
        const consumed = Math.min(5, inv.food);
        this.inventorySystem.removeFromAgent(entityId, "food", consumed);
        needs.hunger = Math.min(100, needs.hunger + consumed * 10);
      }
    }
  }

  private tryEmergencyWater(entityId: string, needs: EntityNeedsData): void {
    if (this.inventorySystem) {
      const inv = this.inventorySystem.getAgentInventory(entityId);
      if (inv && inv.water > 0) {
        const consumed = Math.min(5, inv.water);
        this.inventorySystem.removeFromAgent(entityId, "water", consumed);
        needs.thirst = Math.min(100, needs.thirst + consumed * 10);
      }
    }
  }

  private applyEmergencyRest(_entityId: string, needs: EntityNeedsData): void {
    const emergencyRest = 2;
    needs.energy = Math.min(100, needs.energy + emergencyRest);
  }

  private applyNeedDecay(
    needs: EntityNeedsData,
    deltaSeconds: number,
    entityId: string,
    action: string = "idle",
  ): void {
    const ageMultiplier = this.getAgeDecayMultiplier(entityId);
    const divineModifiers = this.applyDivineFavorModifiers(
      entityId,
      this.config.decayRates,
    );

    for (const [need, rate] of Object.entries(divineModifiers)) {
      let finalRate = rate * ageMultiplier;

      if (need === "energy") {
        if (action === "sleep")
          finalRate = -5.0; // Recover energy fast
        else if (action === "rest")
          finalRate = -2.0; // Recover energy
        else if (action === "idle")
          finalRate = -0.5; // Recover energy slowly
        else if (action === "work")
          finalRate *= 1.5; // Work consumes more energy
        else if (action === "run") finalRate *= 2.0;
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
      case "child":
        return 0.7;
      case "adult":
        return 1.0;
      case "elder":
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
        "agent",
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

  private findZonesNearPosition(
    position: { x: number; y: number },
    radius: number,
  ): Zone[] {
    const cacheKey = `${Math.floor(position.x / 100)},${Math.floor(position.y / 100)}`;

    if (this.zoneCache.has(cacheKey)) {
      const cached = this.zoneCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.ZONE_CACHE_TTL) {
        return cached.zones;
      }
    }

    const zones = (this.gameState.zones || []).filter((zone) => {
      const dx = zone.bounds.x - position.x;
      const dy = zone.bounds.y - position.y;
      return Math.sqrt(dx * dx + dy * dy) < radius + zone.bounds.width / 2;
    });

    this.zoneCache.set(cacheKey, {
      zones,
      timestamp: Date.now(),
    });

    return zones;
  }

  private cleanZoneCache(now: number): void {
    for (const [key, cache] of this.zoneCache.entries()) {
      if (now - cache.timestamp > this.ZONE_CACHE_TTL) {
        this.zoneCache.delete(key);
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
        need: "hunger",
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
}
