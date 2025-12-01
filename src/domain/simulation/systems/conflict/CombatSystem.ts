import { randomUUID } from "node:crypto";
import type { GameState } from "@/shared/types/game-types";
import { simulationEvents, GameEventType } from "../../core/events";
import { WeaponId } from "../../../../shared/constants/CraftingEnums";
import { EntityType } from "../../../../shared/constants/EntityEnums";
import { CombatEventType } from "../../../../shared/constants/CombatEnums";
import type {
  CombatEngagedLog,
  CombatHitLog,
  CombatKillLog,
  CombatLogEntry,
  CombatWeaponCraftedLog,
  CombatWeaponEquippedLog,
} from "@/shared/types/simulation/combat";
import { getWeapon } from "../../../data/WeaponCatalog";
import type { ResourceType } from "@/shared/types/simulation/economy";
import type { SimulationEntity } from "../../core/schema";
import { InventorySystem } from "../economy/InventorySystem";
import { LifeCycleSystem } from "../lifecycle/LifeCycleSystem";
import { SocialSystem } from "../social/SocialSystem";

import type { AnimalSystem } from "../world/animals/AnimalSystem";
import type { ConflictResolutionSystem } from "./ConflictResolutionSystem";
import { getFrameTime } from "../../../../shared/FrameTime";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../../core/PerformanceMonitor";
import type { GPUComputeService } from "../../core/GPUComputeService";

interface CombatConfig {
  decisionIntervalMs: number;
  engagementRadius: number;
  baseCooldownMs: number;
}

interface EntityStats {
  health?: number;
  morale?: number;
  stress?: number;
  stamina?: number;
  wounds?: number;
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  decisionIntervalMs: 750,
  engagementRadius: 70,
  baseCooldownMs: 4000,
};

const WEAPON_COSTS: Record<WeaponId, Partial<Record<ResourceType, number>>> = {
  [WeaponId.UNARMED]: {},
  [WeaponId.WOODEN_CLUB]: { wood: 10 },
  [WeaponId.STONE_DAGGER]: { stone: 8 },
};

export interface PersonalCombatEvent {
  type: "kill" | "assist" | "death" | "damage_dealt" | "damage_taken";
  targetId?: string;
  weaponId?: WeaponId;
  amount?: number;
  timestamp: number;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import { SharedSpatialIndex } from "../../core/SharedSpatialIndex";
import type { EntityIndex } from "../../core/EntityIndex";
import type { ICombatSystem } from "../agents/SystemRegistry";
import { QuestStatus } from '../../../../shared/constants/QuestEnums';
import { SocialStatus } from '../../../../shared/constants/AgentEnums';
import { ActionType } from '../../../../shared/constants/AIEnums';

/**
 * System for managing combat between entities.
 *
 * Features:
 * - Spatial grid for efficient enemy detection
 * - Weapon system with damage calculations
 * - Attack cooldowns and engagement radius
 * - Combat logging for history tracking
 * - Integration with social system for relationship effects
 * - Animal combat support
 *
 * @see SpatialGrid for spatial queries
 * @see WeaponCatalog for weapon definitions
 */
@injectable()
export class CombatSystem implements ICombatSystem {
  private readonly config: CombatConfig;

  private lastUpdate = Date.now();
  private readonly lastAttackAt = new Map<string, number>();
  private readonly equippedWeapons = new Map<string, WeaponId>();
  private readonly maxLogEntries = 200;
  private combatLog: CombatLogEntry[];
  private personalCombatHistory = new Map<string, PersonalCombatEvent[]>();

  private animalSystem?: AnimalSystem;
  private conflictResolutionSystem?: ConflictResolutionSystem;
  private sharedSpatialIndex?: SharedSpatialIndex;
  private gpuService?: GPUComputeService;
  private entityIndex?: EntityIndex;

  private attackerPositionsBuffer: Float32Array | null = null;
  private targetPositionsBuffer: Float32Array | null = null;

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
    @inject(TYPES.LifeCycleSystem)
    private readonly lifeCycleSystem: LifeCycleSystem,
    @inject(TYPES.SocialSystem) private readonly socialSystem: SocialSystem,
    @inject(TYPES.AnimalSystem) @optional() animalSystem?: AnimalSystem,
    @inject(TYPES.ConflictResolutionSystem)
    @optional()
    conflictResolutionSystem?: ConflictResolutionSystem,
    @inject(TYPES.SharedSpatialIndex)
    @optional()
    sharedSpatialIndex?: SharedSpatialIndex,
    @inject(TYPES.GPUComputeService)
    @optional()
    gpuService?: GPUComputeService,
    @inject(TYPES.EntityIndex)
    @optional()
    entityIndex?: EntityIndex,
  ) {
    this.animalSystem = animalSystem;
    this.conflictResolutionSystem = conflictResolutionSystem;
    this.sharedSpatialIndex = sharedSpatialIndex;
    this.gpuService = gpuService;
    this.entityIndex = entityIndex;
    this.config = DEFAULT_COMBAT_CONFIG;

    this.combatLog = this.state.combatLog ?? [];
    this.state.combatLog = this.combatLog;

    simulationEvents.on(
      GameEventType.AGENT_BIRTH,
      this.handleAgentBirth.bind(this),
    );
  }

  public getPersonalCombatHistory(agentId: string): PersonalCombatEvent[] {
    return this.personalCombatHistory.get(agentId) || [];
  }

  private recordPersonalEvent(
    agentId: string,
    event: Omit<PersonalCombatEvent, "timestamp">,
  ): void {
    const history = this.personalCombatHistory.get(agentId) || [];
    history.unshift({ ...event, timestamp: Date.now() });
    if (history.length > 10) {
      history.pop();
    }
    this.personalCombatHistory.set(agentId, history);
  }

  private handleAgentBirth(data: { entityId: string }): void {
    const agent = this.lifeCycleSystem.getAgent(data.entityId);
    if (agent && agent.socialStatus === SocialStatus.WARRIOR) {
      this.equip(data.entityId, WeaponId.WOODEN_CLUB);
    }
  }

  public async update(_deltaMs: number): Promise<void> {
    const startTime = performance.now();
    const now = getFrameTime();
    if (now - this.lastUpdate < this.config.decisionIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    const entities = this.state.entities;
    if (!entities || entities.length === 0) return;

    const entitiesById = new Map<string, SimulationEntity>();
    const validEntities = entities.filter((e) => !e.isDead && e.position);

    for (const entity of validEntities) {
      entitiesById.set(entity.id, entity);
    }

    if (this.animalSystem) {
      const animals = this.animalSystem.getAnimals();
      for (const [animalId, animal] of animals) {
        if (animal.isDead || !animal.position) continue;
        const animalX = animal.position.x;
        const animalY = animal.position.y;
        const animalEntity: SimulationEntity = {
          id: animalId,
          type: EntityType.ANIMAL,
          x: animalX,
          y: animalY,
          position: { x: animalX, y: animalY },
          isDead: false,
          tags: [EntityType.ANIMAL],
          stats: {
            health: animal.health,
            stamina: 100,
          },
        };
        entitiesById.set(animalId, animalEntity);
      }
    }

    const potentialAttackers = validEntities;

    /**
     * Umbral para activar procesamiento por lotes en combate.
     * 10 entidades: CombatSystem realiza consultas espaciales costosas y cálculos de daño,
     * por lo que el batch processing se activa con menos entidades para mejorar rendimiento.
     */
    const BATCH_THRESHOLD = 10;
    if (potentialAttackers.length > BATCH_THRESHOLD) {
      await this.updateBatch(potentialAttackers, entitiesById, now);
    } else {
      for (const attacker of potentialAttackers) {
        if (!attacker.position) continue;
        const weaponId = this.getEquipped(attacker.id);
        const weapon = getWeapon(weaponId);

        const radius = Math.max(this.config.engagementRadius, weapon.range);
        let nearby: SimulationEntity[] = [];

        if (this.sharedSpatialIndex) {
          const results = this.sharedSpatialIndex.queryRadius(
            attacker.position,
            radius,
            EntityType.ALL,
          );
          nearby = results
            .filter((candidate) => candidate.entity !== attacker.id)
            .map((candidate) => entitiesById.get(candidate.entity))
            .filter((candidate): candidate is SimulationEntity =>
              Boolean(candidate && !candidate.isDead),
            );
          this.sharedSpatialIndex.releaseResults(results);
        }

        for (const target of nearby) {
          if (!this.shouldAttack(attacker, target)) continue;
          if (!this.isOffCooldown(attacker.id, weaponId, now)) continue;

          this.resolveAttack(attacker, target, weaponId, now);
          this.lastAttackAt.set(attacker.id, now);
          break;
        }
      }
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "CombatSystem",
      "update",
      duration,
    );
  }

  private async updateBatch(
    attackers: SimulationEntity[],
    entitiesById: Map<string, SimulationEntity>,
    now: number,
  ): Promise<void> {
    const startTime = performance.now();

    if (this.gpuService?.isGPUAvailable() && attackers.length >= 30) {
      await this.updateBatchGPU(attackers, entitiesById, now);
      return;
    }

    const queries = attackers
      .map((attacker) => {
        if (!attacker.position) return null;
        const weaponId = this.getEquipped(attacker.id);
        const weapon = getWeapon(weaponId);
        return {
          center: attacker.position,
          radius: Math.max(this.config.engagementRadius, weapon.range),
          attacker,
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    for (const query of queries) {
      const { attacker, center, radius } = query;

      let nearby: SimulationEntity[] = [];

      if (this.sharedSpatialIndex) {
        const results = this.sharedSpatialIndex.queryRadius(
          center,
          radius,
          EntityType.ALL,
        );
        nearby = results
          .filter((candidate) => candidate.entity !== attacker.id)
          .map((candidate) => entitiesById.get(candidate.entity))
          .filter((candidate): candidate is SimulationEntity =>
            Boolean(candidate && !candidate.isDead),
          );
        this.sharedSpatialIndex.releaseResults(results);
      }

      for (const target of nearby) {
        if (!this.shouldAttack(attacker, target)) continue;

        const weaponId = this.getEquipped(attacker.id);
        if (!this.isOffCooldown(attacker.id, weaponId, now)) continue;

        this.resolveAttack(attacker, target, weaponId, now);
        this.lastAttackAt.set(attacker.id, now);
        break;
      }
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "CombatSystem",
      "updateBatch",
      duration,
    );
  }

  /**
   * GPU-accelerated combat batch processing.
   * Uses pairwise distance matrix for efficient enemy detection.
   */
  private async updateBatchGPU(
    attackers: SimulationEntity[],
    entitiesById: Map<string, SimulationEntity>,
    now: number,
  ): Promise<void> {
    const startTime = performance.now();
    const attackersWithPos = attackers.filter((a) => a.position);
    const allEntities = Array.from(entitiesById.values()).filter(
      (e) => e.position && !e.isDead,
    );

    if (attackersWithPos.length === 0 || allEntities.length === 0) return;

    const neededAttackerSize = attackersWithPos.length * 2;
    if (
      !this.attackerPositionsBuffer ||
      this.attackerPositionsBuffer.length < neededAttackerSize
    ) {
      this.attackerPositionsBuffer = new Float32Array(
        Math.ceil(neededAttackerSize * 1.5),
      );
    }

    const neededTargetSize = allEntities.length * 2;
    if (
      !this.targetPositionsBuffer ||
      this.targetPositionsBuffer.length < neededTargetSize
    ) {
      this.targetPositionsBuffer = new Float32Array(
        Math.ceil(neededTargetSize * 1.5),
      );
    }

    for (let i = 0; i < attackersWithPos.length; i++) {
      this.attackerPositionsBuffer[i * 2] = attackersWithPos[i].position!.x;
      this.attackerPositionsBuffer[i * 2 + 1] = attackersWithPos[i].position!.y;
    }

    for (let i = 0; i < allEntities.length; i++) {
      this.targetPositionsBuffer[i * 2] = allEntities[i].position!.x;
      this.targetPositionsBuffer[i * 2 + 1] = allEntities[i].position!.y;
    }

    const targetsView = this.targetPositionsBuffer.subarray(
      0,
      neededTargetSize,
    );

    for (let a = 0; a < attackersWithPos.length; a++) {
      const attacker = attackersWithPos[a];
      const weaponId = this.getEquipped(attacker.id);
      const weapon = getWeapon(weaponId);
      const radius = Math.max(this.config.engagementRadius, weapon.range);
      const radiusSq = radius * radius;

      const distances = await this.gpuService!.computeDistancesBatch(
        attacker.position!.x,
        attacker.position!.y,
        targetsView,
      );

      for (let t = 0; t < allEntities.length; t++) {
        if (distances[t] > radiusSq) continue;

        const target = allEntities[t];
        if (target.id === attacker.id) continue;
        if (!this.shouldAttack(attacker, target)) continue;
        if (!this.isOffCooldown(attacker.id, weaponId, now)) continue;

        this.resolveAttack(attacker, target, weaponId, now);
        this.lastAttackAt.set(attacker.id, now);
        break;
      }
    }

    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "CombatSystem",
      "updateBatchGPU",
      duration,
    );
  }

  public getNearbyEnemies(
    agentId: string,
    hostilityThreshold = -0.4,
  ): string[] {
    const entities = this.state.entities;
    if (!entities || entities.length === 0) return [];

    const foundAgent = this.entityIndex?.getEntity(agentId);
    if (
      !foundAgent ||
      !foundAgent.position ||
      foundAgent.type !== EntityType.AGENT
    )
      return [];

    const radius = this.config.engagementRadius * 2;
    const result: string[] = [];

    for (const entity of entities) {
      if (
        entity.id === agentId ||
        entity.isDead ||
        !entity.position ||
        entity.type !== EntityType.AGENT
      ) {
        continue;
      }

      const affinity = this.socialSystem.getAffinityBetween(agentId, entity.id);
      if (affinity > hostilityThreshold) continue;

      const dx = entity.position.x - foundAgent.position.x;
      const dy = entity.position.y - foundAgent.position.y;
      if (Math.hypot(dx, dy) <= radius) {
        result.push(entity.id);
      }
    }

    return result;
  }

  public equip(agentId: string, weaponId: WeaponId): void {
    this.equippedWeapons.set(agentId, weaponId);
    simulationEvents.emit(GameEventType.COMBAT_WEAPON_EQUIPPED, {
      agentId,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatWeaponEquippedLog>({
        type: CombatEventType.WEAPON_EQUIPPED,
        agentId,
        weapon: weaponId,
      }),
    );
  }

  public getEquipped(agentId: string): WeaponId {
    return this.equippedWeapons.get(agentId) ?? WeaponId.UNARMED;
  }

  public craftWeapon(agentId: string, weaponId: WeaponId): boolean {
    const cost = WEAPON_COSTS[weaponId];
    if (!cost) return false;

    const inventory =
      this.inventorySystem.getAgentInventory(agentId) ??
      this.inventorySystem.initializeAgentInventory(agentId);

    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as ResourceType;
      if ((inventory[key] ?? 0) < amount) {
        return false;
      }
    }

    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as ResourceType;
      this.inventorySystem.removeFromAgent(agentId, key, amount);
    }

    this.equip(agentId, weaponId);
    simulationEvents.emit(GameEventType.COMBAT_WEAPON_CRAFTED, {
      agentId,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatWeaponCraftedLog>({
        type: CombatEventType.WEAPON_CRAFTED,
        agentId,
        weapon: weaponId,
      }),
    );
    return true;
  }

  private shouldAttack(
    attacker: SimulationEntity,
    target: SimulationEntity,
  ): boolean {
    if (attacker.id === target.id) return false;
    if (target.isDead || target.immortal) return false;

    const targetIsAnimal =
      target.type === EntityType.ANIMAL || target.tags?.includes(EntityType.ANIMAL);
    if (targetIsAnimal) return true;

    const attackerProfile = this.lifeCycleSystem.getAgent(attacker.id);
    const targetProfile = this.lifeCycleSystem.getAgent(target.id);
    if (!attackerProfile || !targetProfile) {
      return false;
    }

    const affinity = this.socialSystem.getAffinityBetween(
      attacker.id,
      target.id,
    );
    if (affinity <= -0.4) {
      return true;
    }

    const aggression =
      attackerProfile.traits?.aggression ?? attacker.traits?.aggression ?? 0.3;
    if (aggression < 0.6) return false;

    return Math.random() < aggression * 0.25;
  }

  private isOffCooldown(
    agentId: string,
    weaponId: WeaponId,
    now: number,
  ): boolean {
    const lastAttack = this.lastAttackAt.get(agentId) ?? 0;
    let cooldown = this.config.baseCooldownMs;
    const weapon = getWeapon(weaponId);
    if (weapon.attackSpeed) {
      cooldown = weapon.attackSpeed * 1000;
    }
    return now - lastAttack >= cooldown;
  }

  private resolveAttack(
    attacker: SimulationEntity,
    target: SimulationEntity,
    weaponId: WeaponId,
    timestamp: number,
  ): void {
    if (target.isDead) {
      return;
    }

    if (this.conflictResolutionSystem && attacker.position) {
      const zone = this.findZoneAtPosition(attacker.position);
      if (zone) {
        const violation = this.conflictResolutionSystem.handleCombatInZone(
          attacker.id,
          target.id,
          zone.id,
          zone.type,
          attacker.position,
        );
        if (violation.violated && violation.sanction) {
          if (violation.sanction.truceDuration && this.socialSystem) {
            this.socialSystem.imposeTruce(
              attacker.id,
              target.id,
              violation.sanction.truceDuration,
            );
          }
        }
      }
    }

    const weapon = getWeapon(weaponId);
    const targetStats = this.ensureStats(target);
    const attackerStats = this.ensureStats(attacker);
    const attackerProfile = this.lifeCycleSystem.getAgent(attacker.id);
    const aggression =
      attackerProfile?.traits?.aggression ?? attacker.traits?.aggression ?? 0.3;

    const base = weapon.baseDamage * (0.8 + Math.random() * 0.4);
    const scale = 0.5 + aggression * 0.7;
    const crit = Math.random() < weapon.critChance;
    const damage = Math.max(
      1,
      Math.round(base * scale * (crit ? weapon.critMultiplier : 1)),
    );

    const newHealth = Math.max(0, (targetStats.health ?? 100) - damage);

    simulationEvents.emit(GameEventType.COMBAT_ENGAGED, {
      attackerId: attacker.id,
      targetId: target.id,
      weapon: weaponId,
      attackerX: attacker.position?.x,
      attackerY: attacker.position?.y,
      targetX: target.position?.x,
      targetY: target.position?.y,
      attackerHealth: attackerStats.health ?? 100,
      targetHealth: newHealth,
      timestamp,
    });
    this.appendLog(
      this.createLogEntry<CombatEngagedLog>({
        type: CombatEventType.ENGAGED,
        attackerId: attacker.id,
        targetId: target.id,
        weapon: weaponId,
        attackerX: attacker.position?.x,
        attackerY: attacker.position?.y,
        targetX: target.position?.x,
        targetY: target.position?.y,
        attackerHealth: attackerStats.health ?? 100,
        targetHealth: newHealth,
      }),
    );

    this.applyStatChanges(targetStats, damage);
    targetStats.health = newHealth;

    simulationEvents.emit(GameEventType.COMBAT_HIT, {
      attackerId: attacker.id,
      targetId: target.id,
      damage,
      crit,
      weapon: weaponId,
      remaining: newHealth,
      remainingHealth: newHealth,
      x: target.position?.x,
      y: target.position?.y,
    });
    this.appendLog(
      this.createLogEntry<CombatHitLog>({
        type: CombatEventType.HIT,
        attackerId: attacker.id,
        targetId: target.id,
        weapon: weaponId,
        damage,
        crit,
        remainingHealth: newHealth,
        x: target.position?.x,
        y: target.position?.y,
      }),
    );

    if (newHealth <= 0) {
      this.handleKill(attacker, target, weaponId);
    }
  }

  private applyStatChanges(stats: EntityStats, damage: number): void {
    stats.morale = Math.max(0, (stats.morale ?? 60) - Math.round(damage * 0.6));
    stats.stress = Math.min(
      100,
      (stats.stress ?? 40) + Math.round(damage * 0.4),
    );
    stats.wounds = Math.min(
      100,
      (stats.wounds ?? 0) + Math.round(damage * 0.5),
    );
    stats.stamina = Math.max(
      0,
      (stats.stamina ?? 60) - Math.round(damage * 0.3),
    );
  }

  /**
   * Handles entity death from combat.
   * Delegates actual death handling to LifeCycleSystem.
   */
  private handleKill(
    attacker: SimulationEntity,
    target: SimulationEntity,
    weaponId: WeaponId,
  ): void {
    this.lifeCycleSystem.removeAgent(target.id);

    this.equippedWeapons.delete(target.id);

    this.recordPersonalEvent(attacker.id, {
      type: CombatEventType.KILL,
      targetId: target.id,
      weaponId,
    });

    this.recordPersonalEvent(target.id, {
      type: ActionType.DEATH,
      targetId: attacker.id,
      weaponId,
    });

    simulationEvents.emit(GameEventType.COMBAT_KILL, {
      attackerId: attacker.id,
      targetId: target.id,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatKillLog>({
        type: CombatEventType.KILL,
        attackerId: attacker.id,
        targetId: target.id,
        weapon: weaponId,
      }),
    );

    if (target.tags?.includes(EntityType.ANIMAL) || target.type === EntityType.ANIMAL) {
      simulationEvents.emit(GameEventType.ANIMAL_HUNTED, {
        animalId: target.id,
        hunterId: attacker.id,
      });
    }
  }

  private findZoneAtPosition(position: {
    x: number;
    y: number;
  }): { id: string; type: string } | null {
    const zones = this.state.zones || [];
    for (const zone of zones) {
      if (
        zone.bounds &&
        position.x >= zone.bounds.x &&
        position.x <= zone.bounds.x + zone.bounds.width &&
        position.y >= zone.bounds.y &&
        position.y <= zone.bounds.y + zone.bounds.height
      ) {
        return { id: zone.id, type: zone.type };
      }
    }
    return null;
  }

  private ensureStats(entity: SimulationEntity): EntityStats {
    if (!entity.stats) {
      entity.stats = {
        health: 100,
        morale: 60,
        stress: 40,
        stamina: 50,
        wounds: 0,
      };
    }
    if (entity.stats.health === undefined) entity.stats.health = 100;
    return entity.stats;
  }

  private appendLog(entry: CombatLogEntry): void {
    this.combatLog.push(entry);
    if (this.combatLog.length > this.maxLogEntries) {
      this.combatLog.splice(0, this.combatLog.length - this.maxLogEntries);
    }
    this.state.combatLog = this.combatLog;
  }

  private createLogEntry<T extends CombatLogEntry>(
    entry: Omit<T, "id" | "timestamp">,
  ): T {
    return {
      ...entry,
      id: randomUUID(),
      timestamp: Date.now(),
    } as T;
  }

  // ==========================================================================
  // ECS INTERFACE METHODS - ICombatSystem
  // ==========================================================================

  /**
   * System name for ECS registration
   */
  public readonly name = "combat";

  /**
   * Request to attack a target.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestAttack(
    agentId: string,
    targetId: string,
  ): { status: "delegated" | "completed" | "failed" | "in_progress"; system: string; message?: string; data?: unknown } {
    // Find attacker entity
    const attacker = this.state.entities?.find(e => e.id === agentId);
    if (!attacker || !attacker.position) {
      return {
        status: QuestStatus.FAILED,
        system: "combat",
        message: `Attacker ${agentId} not found`,
      };
    }

    // Find target entity
    let target = this.state.entities?.find(e => e.id === targetId);
    
    // Also check animals
    if (!target && this.animalSystem) {
      const animal = this.animalSystem.getAnimal(targetId);
      if (animal) {
        target = {
          id: animal.id,
          type: EntityType.ANIMAL,
          position: animal.position,
          stats: { health: animal.health },
          tags: [EntityType.ANIMAL],
        } as SimulationEntity;
      }
    }

    if (!target || !target.position) {
      return {
        status: QuestStatus.FAILED,
        system: "combat",
        message: `Target ${targetId} not found`,
      };
    }

    // Check range
    const dx = attacker.position.x - target.position.x;
    const dy = attacker.position.y - target.position.y;
    const distSq = dx * dx + dy * dy;
    const rangeSq = this.config.engagementRadius * this.config.engagementRadius;

    if (distSq > rangeSq) {
      return {
        status: "delegated",
        system: "movement",
        message: "Target out of range, moving closer",
        data: { targetPosition: target.position },
      };
    }

    // Check cooldown
    const now = getFrameTime();
    const lastAttack = this.lastAttackAt.get(agentId) ?? 0;
    if (now - lastAttack < this.config.baseCooldownMs) {
      return {
        status: "in_progress",
        system: "combat",
        message: "Attack on cooldown",
        data: { cooldownRemaining: this.config.baseCooldownMs - (now - lastAttack) },
      };
    }

    // Perform attack
    const weaponId = this.equippedWeapons.get(agentId) ?? WeaponId.UNARMED;
    const weapon = getWeapon(weaponId);
    const damage = weapon?.baseDamage ?? 10;

    // Apply damage
    const targetStats = this.ensureStats(target);
    const remainingHealth = Math.max(0, (targetStats.health ?? 100) - damage);
    targetStats.health = remainingHealth;

    this.lastAttackAt.set(agentId, now);

    // Log hit
    this.appendLog(
      this.createLogEntry<CombatHitLog>({
        type: CombatEventType.HIT,
        attackerId: agentId,
        targetId,
        weapon: weaponId,
        damage,
        crit: false,
        remainingHealth,
      }),
    );

    simulationEvents.emit(GameEventType.COMBAT_HIT, {
      attackerId: agentId,
      targetId,
      damage,
      weapon: weaponId,
    });

    // Check for kill
    if (targetStats.health <= 0) {
      this.handleKill(attacker, target, weaponId);
      return {
        status: "completed",
        system: "combat",
        message: `Killed ${targetId}`,
        data: { targetId, damage, killed: true },
      };
    }

    return {
      status: "in_progress",
      system: "combat",
      message: `Hit ${targetId} for ${damage} damage`,
      data: { targetId, damage, targetHealth: targetStats.health },
    };
  }

  /**
   * Request to flee from a position/threat.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestFlee(
    agentId: string,
    fromPosition: { x: number; y: number },
  ): { status: "delegated" | "completed" | "failed" | "in_progress"; system: string; message?: string; data?: unknown } {
    // Find agent
    const agent = this.state.entities?.find(e => e.id === agentId);
    if (!agent || !agent.position) {
      return {
        status: QuestStatus.FAILED,
        system: "combat",
        message: `Agent ${agentId} not found`,
      };
    }

    const agentPos = agent.position;

    // Calculate flee direction (opposite of threat)
    const dx = agentPos.x - fromPosition.x;
    const dy = agentPos.y - fromPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1) {
      // Pick random direction if at same position
      const angle = Math.random() * Math.PI * 2;
      const fleeTarget = {
        x: agentPos.x + Math.cos(angle) * 200,
        y: agentPos.y + Math.sin(angle) * 200,
      };
      
      return {
        status: "delegated",
        system: "movement",
        message: "Fleeing in random direction",
        data: { target: fleeTarget },
      };
    }

    // Normalize and extend
    const fleeDistance = 200;
    const fleeTarget = {
      x: agentPos.x + (dx / distance) * fleeDistance,
      y: agentPos.y + (dy / distance) * fleeDistance,
    };

    return {
      status: "delegated",
      system: "movement",
      message: "Fleeing from threat",
      data: { target: fleeTarget, fromPosition },
    };
  }

  /**
   * End combat state for an agent.
   */
  public endCombat(agentId: string): void {
    // Remove from active combats if tracked
    this.lastAttackAt.delete(agentId);
  }

  /**
   * Check if agent is in combat.
   */
  public isInCombat(agentId: string): boolean {
    const now = getFrameTime();
    const lastAttack = this.lastAttackAt.get(agentId);
    // Consider in combat if attacked within last 10 seconds
    return lastAttack !== undefined && (now - lastAttack) < 10000;
  }
}
