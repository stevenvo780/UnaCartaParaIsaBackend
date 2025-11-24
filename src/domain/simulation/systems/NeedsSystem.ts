import { EventEmitter } from "events";
import { GameState } from "../../core/GameState";
import { EntityNeedsData, NeedsConfig } from "../../types/simulation/needs";
import { simulationEvents, GameEventNames } from "../../core/events";
import type { LifeCycleSystem } from "./LifeCycleSystem";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { Zone } from "../../types/game-types";

export class NeedsSystem extends EventEmitter {
  private gameState: GameState;
  private config: NeedsConfig;
  private entityNeeds: Map<string, EntityNeedsData>;
  private lastUpdate: number = 0;

  // Dependencies
  private lifeCycleSystem?: LifeCycleSystem;
  private divineFavorSystem?: DivineFavorSystem;
  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;

  // Feature 2: Respawn Queue
  private respawnQueue = new Map<string, number>();

  // Feature 7: Zone Cache
  private zoneCache = new Map<string, { zones: Zone[]; timestamp: number }>();
  private readonly ZONE_CACHE_TTL = 5000;

  constructor(
    gameState: GameState,
    config?: Partial<NeedsConfig>,
    systems?: {
      lifeCycleSystem?: LifeCycleSystem;
      divineFavorSystem?: DivineFavorSystem;
      inventorySystem?: InventorySystem;
      socialSystem?: SocialSystem;
    },
  ) {
    super();
    this.gameState = gameState;
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
      // New config fields
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
    if (systems.divineFavorSystem) this.divineFavorSystem = systems.divineFavorSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
  }

  public update(deltaTimeMs: number): void {
    const now = Date.now();

    // Process respawn queue
    this.processRespawnQueue(now);

    // Clean zone cache periodically
    if (Math.random() < 0.01) this.cleanZoneCache(now);

    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }

    const dtSeconds = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Process all entities
    for (const [entityId, needs] of this.entityNeeds.entries()) {
      // 1. Apply Decay
      this.applyNeedDecay(needs, dtSeconds, entityId);

      // 2. Apply Zone Benefits (Feature 1)
      this.handleZoneBenefits(entityId, needs, dtSeconds);

      // 3. Apply Social Benefits (Feature 5)
      this.applySocialMoraleBoost(entityId, needs);

      // 4. Apply Cross Effects (Feature 8)
      if (this.config.crossEffectsEnabled) {
        this.applyCrossEffects(needs);
      }

      // 5. Check Emergency (Feature 3)
      this.checkEmergencyNeeds(entityId, needs);

      // 6. Check Death (Feature 2)
      if (this.checkForDeath(entityId, needs)) {
        continue; // Entity died, skip rest
      }

      // 7. Emit Events (Feature 10)
      this.emitNeedEvents(entityId, needs);
    }
  }

  /**
   * Feature 1: Zone Benefits
   */
  private handleZoneBenefits(
    entityId: string,
    needs: EntityNeedsData,
    deltaSeconds: number,
  ): void {
    const entity = this.gameState.agents?.find((e) => e.id === entityId);
    if (!entity || !entity.position) return;

    const nearbyZones = this.findZonesNearPosition(entity.position, 50);

    for (const zone of nearbyZones) {
      const multiplier = this.config.zoneBonusMultiplier || 1.0;

      switch (zone.type) {
        case "food":
        case "kitchen":
          const hungerBonus = 15 * deltaSeconds * multiplier;
          needs.hunger = Math.min(100, needs.hunger + hungerBonus);
          break;

        case "water":
        case "well":
          const thirstBonus = 20 * deltaSeconds * multiplier;
          needs.thirst = Math.min(100, needs.thirst + thirstBonus);
          break;

        case "rest":
        case "bed":
        case "shelter":
        case "house":
          const energyBonus = 12 * deltaSeconds * multiplier;
          needs.energy = Math.min(100, needs.energy + energyBonus);
          break;

        case "hygiene":
        case "bath":
          const hygieneBonus = 25 * deltaSeconds * multiplier;
          needs.hygiene = Math.min(100, needs.hygiene + hygieneBonus);
          break;

        case "social":
        case "market":
        case "gathering":
          const socialBonus = 8 * deltaSeconds * multiplier;
          const funBonus = 10 * deltaSeconds * multiplier;
          needs.social = Math.min(100, needs.social + socialBonus);
          needs.fun = Math.min(100, needs.fun + funBonus);
          break;

        case "entertainment":
        case "festival":
          const entertainmentBonus = 20 * deltaSeconds * multiplier;
          needs.fun = Math.min(100, needs.fun + entertainmentBonus);
          needs.mentalHealth = Math.min(100, needs.mentalHealth + entertainmentBonus * 0.5);
          break;

        case "temple":
        case "sanctuary":
          const mentalBonus = 15 * deltaSeconds * multiplier;
          needs.mentalHealth = Math.min(100, needs.mentalHealth + mentalBonus);
          needs.social = Math.min(100, needs.social + mentalBonus * 0.3);
          break;
      }
    }
  }

  /**
   * Feature 2: Death & Respawn
   */
  private checkForDeath(entityId: string, needs: EntityNeedsData): boolean {
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
    console.log(`💀 Entity ${entityId} died from ${cause}`);

    simulationEvents.emit(GameEventNames.AGENT_DIED, {
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
    for (const [entityId, respawnTime] of this.respawnQueue.entries()) {
      if (now >= respawnTime) {
        this.respawnEntity(entityId);
        this.respawnQueue.delete(entityId);
      }
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

    console.log(`✨ Entity ${entityId} respawned`);

    simulationEvents.emit(GameEventNames.AGENT_RESPAWNED, {
      agentId: entityId,
      timestamp: Date.now(),
    });
  }

  /**
   * Feature 3: Emergency Fallbacks
   */
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

  private applyEmergencyRest(entityId: string, needs: EntityNeedsData): void {
    const emergencyRest = 2;
    needs.energy = Math.min(100, needs.energy + emergencyRest);
  }

  /**
   * Feature 4 & 6: Decay with Age & Divine Favor
   */
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
        needs[key] = Math.max(0, (needs[key] as number) - finalRate * deltaSeconds);
      }
    }
  }

  private getAgeDecayMultiplier(entityId: string): number {
    if (!this.lifeCycleSystem) return 1.0;
    const agent = this.lifeCycleSystem.getAgent(entityId);
    if (!agent) return 1.0;

    switch (agent.lifeStage) {
      case "child": return 0.7;
      case "adult": return 1.0;
      case "elder": return 1.4;
      default: return 1.0;
    }
  }

  private applyDivineFavorModifiers(
    entityId: string,
    decayRates: Record<string, number>,
  ): Record<string, number> {
    if (!this.divineFavorSystem) return decayRates;
    const favor = this.divineFavorSystem.getFavor(entityId);
    const modifier = 1 - (favor * 0.3);

    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(decayRates)) {
      result[key] = val * modifier;
    }
    return result;
  }

  /**
   * Feature 5: Social Integration
   */
  private applySocialMoraleBoost(entityId: string, needs: EntityNeedsData): void {
    if (!this.socialSystem) return;

    // Placeholder for truce check
    // const isInTruce = this.socialSystem.isInTruce(entityId);
    // if (isInTruce) { ... }

    // Placeholder for affinity check
    // const avgAffinity = this.socialSystem.getAverageAffinity(entityId);
    // if (avgAffinity > 0.5) { ... }
  }

  /**
   * Feature 7: Zone Caching
   */
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

  /**
   * Feature 8: Enhanced Cross-Effects
   */
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
      needs.mentalHealth = Math.max(0, needs.mentalHealth - hungerPenalty * 0.5);
    }

    if (needs.thirst < 30) {
      const thirstPenalty = (30 - needs.thirst) * 0.05;
      needs.energy = Math.max(0, needs.energy - thirstPenalty * 2);
      needs.mentalHealth = Math.max(0, needs.mentalHealth - thirstPenalty);
    }
  }

  /**
   * Feature 10: Enhanced Events
   */
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

  public updateConfig(partial: Partial<NeedsConfig>): void {
    this.config = { ...this.config, ...partial };
    this.emit("configUpdated", this.config);
  }
}
