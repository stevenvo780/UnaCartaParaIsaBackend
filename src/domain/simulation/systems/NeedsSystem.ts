import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import { EntityNeedsData, NeedsConfig } from "../../types/simulation/needs";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "@/infrastructure/utils/logger";
import type { LifeCycleSystem } from "./LifeCycleSystem";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { Zone } from "../../types/game-types";
import { NeedsBatchProcessor } from "./NeedsBatchProcessor";
import { injectable, inject, unmanaged, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";

@injectable()
export class NeedsSystem extends EventEmitter {
  private gameState: GameState;
  private config: NeedsConfig;
  private entityNeeds: Map<string, EntityNeedsData>;
  private lastUpdate: number = Date.now();

  private lifeCycleSystem?: LifeCycleSystem;
  private divineFavorSystem?: DivineFavorSystem;
  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;

  private respawnQueue = new Map<string, number>();

  private zoneCache = new Map<string, { zones: Zone[]; timestamp: number }>();
  private readonly ZONE_CACHE_TTL = 15000;
  private _tickCounter = 0;

  private batchProcessor: NeedsBatchProcessor;
  /**
   * Umbral para activar procesamiento por lotes.
   * 20 entidades: balance entre overhead de batch setup y beneficios de procesamiento vectorizado.
   * NeedsSystem procesa 7 necesidades por entidad, así que 20 entidades = 140 operaciones.
   */
  private readonly BATCH_THRESHOLD = 20;
  private entityIndex?: EntityIndex;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @unmanaged() config?: Partial<NeedsConfig>,
    @unmanaged()
    systems?: {
      lifeCycleSystem?: LifeCycleSystem;
      divineFavorSystem?: DivineFavorSystem;
      inventorySystem?: InventorySystem;
      socialSystem?: SocialSystem;
    },
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
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
    this.batchProcessor = new NeedsBatchProcessor();

    if (systems) {
      this.lifeCycleSystem = systems.lifeCycleSystem;
      this.divineFavorSystem = systems.divineFavorSystem;
      this.inventorySystem = systems.inventorySystem;
      this.socialSystem = systems.socialSystem;
    }
  }

  public setDependencies(systems: {
    lifeCycleSystem?: LifeCycleSystem;
    divineFavorSystem?: DivineFavorSystem;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
  }): void {
    if (systems.lifeCycleSystem) this.lifeCycleSystem = systems.lifeCycleSystem;
    if (systems.divineFavorSystem)
      this.divineFavorSystem = systems.divineFavorSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
  }

  public update(_deltaTimeMs: number): void {
    const now = Date.now();

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
    for (const [entityId, needs] of this.entityNeeds.entries()) {
      this.applyNeedDecay(needs, dtSeconds, entityId);
      this.handleZoneBenefits(entityId, needs, dtSeconds);
      this.applySocialMoraleBoost(entityId, needs);

      if (this.config.crossEffectsEnabled) {
        this.applyCrossEffects(needs);
      }

      this.checkEmergencyNeeds(entityId, needs);

      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.emitNeedEvents(entityId, needs);
    }
  }

  private updateBatch(dtSeconds: number, _now: number): void {
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
      this.checkEmergencyNeeds(entityId, needs);

      if (this.checkForDeath(entityId, needs)) {
        continue;
      }

      this.emitNeedEvents(entityId, needs);
    }
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
          const energyBonus = 12 * deltaSeconds * multiplier;
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

    // Marcar entidad como no muerta si existe
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
  ): void {
    const ageMultiplier = this.getAgeDecayMultiplier(entityId);
    const divineModifiers = this.applyDivineFavorModifiers(
      entityId,
      this.config.decayRates,
    );

    for (const [need, rate] of Object.entries(divineModifiers)) {
      const finalRate = rate * ageMultiplier;
      const key = need as keyof EntityNeedsData;
      if (typeof needs[key] === "number") {
        needs[key] = Math.max(
          0,
          (needs[key] as number) - finalRate * deltaSeconds,
        );
      }
    }
  }

  private getAgeDecayMultiplier(entityId: string): number {
    if (!this.lifeCycleSystem) return 1.0;
    const agent = this.lifeCycleSystem.getAgent(entityId);
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
    const radiusSq = 100 * 100;

    const nearbyEntities = this.gameState.entities.filter((e) => {
      if (e.id === entityId || !e.position) return false;
      const dx = e.position.x - entityPosition.x;
      const dy = e.position.y - entityPosition.y;
      const distanceSq = dx * dx + dy * dy;
      return distanceSq <= radiusSq;
    });

    if (nearbyEntities.length === 0) return;

    let totalAffinity = 0;
    let affinityCount = 0;

    for (const nearby of nearbyEntities) {
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

  public getNeeds(entityId: string): EntityNeedsData | undefined {
    return this.entityNeeds.get(entityId);
  }

  public getEntityNeeds(entityId: string): EntityNeedsData | undefined {
    return this.getNeeds(entityId);
  }

  public getAllNeeds(): Map<string, EntityNeedsData> {
    return this.entityNeeds;
  }

  public removeEntityNeeds(entityId: string): void {
    this.entityNeeds.delete(entityId);
    this.respawnQueue.delete(entityId);
  }

  public updateConfig(partial: Partial<NeedsConfig>): void {
    this.config = { ...this.config, ...partial };
    this.emit("configUpdated", this.config);
  }

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
