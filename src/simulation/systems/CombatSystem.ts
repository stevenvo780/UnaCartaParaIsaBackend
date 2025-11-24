import { randomUUID } from "node:crypto";
import type { GameState } from "../../types/game-types.js";
import { simulationEvents, GameEventNames } from "../events.js";
import type {
  CombatEngagedLog,
  CombatHitLog,
  CombatKillLog,
  CombatLogEntry,
  CombatWeaponCraftedLog,
  CombatWeaponEquippedLog,
  WeaponId,
} from "../types/combat.js";
import { getWeapon } from "../data/WeaponCatalog.js";
import type { ResourceType } from "../types/economy.js";
import type { SimulationEntity } from "../schema.js";
import { InventorySystem } from "./InventorySystem.js";
import { LifeCycleSystem } from "./LifeCycleSystem.js";
import { SocialSystem } from "./SocialSystem.js";
import { SpatialGrid } from "../../utils/SpatialGrid.js";

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
  unarmed: {},
  wooden_club: { wood: 10 },
  stone_dagger: { stone: 8 },
};

export class CombatSystem {
  private readonly config: CombatConfig;
  private readonly spatialGrid: SpatialGrid<string>;
  private lastUpdate = 0;
  private readonly lastAttackAt = new Map<string, number>();
  private readonly equippedWeapons = new Map<string, WeaponId>();
  private readonly maxLogEntries = 200;
  private combatLog: CombatLogEntry[];

  constructor(
    private readonly state: GameState,
    private readonly inventorySystem: InventorySystem,
    private readonly lifeCycleSystem: LifeCycleSystem,
    private readonly socialSystem: SocialSystem,
    config?: Partial<CombatConfig>,
  ) {
    this.config = { ...DEFAULT_COMBAT_CONFIG, ...config };
    const worldWidth = state.worldSize?.width ?? 2000;
    const worldHeight = state.worldSize?.height ?? 2000;
    this.spatialGrid = new SpatialGrid(worldWidth, worldHeight, this.config.engagementRadius);
    this.combatLog = this.state.combatLog ?? [];
    this.state.combatLog = this.combatLog;
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.decisionIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    const entities = this.state.entities;
    if (!entities || entities.length === 0) return;

    this.spatialGrid.clear();
    const entitiesById = new Map<string, SimulationEntity>();

    for (const entity of entities) {
      if (entity.isDead) continue;
      if (!entity.position) continue;
      entitiesById.set(entity.id, entity);
      this.spatialGrid.insert(entity.id, entity.position.x, entity.position.y);
    }

    for (const attacker of entities) {
      if (attacker.isDead || !attacker.position) continue;
      const weaponId = this.getEquipped(attacker.id);
      const weapon = getWeapon(weaponId);

      const nearby = this.spatialGrid
        .queryRadius(attacker.position, Math.max(this.config.engagementRadius, weapon.range))
        .filter((candidate) => candidate.item !== attacker.id)
        .map((candidate) => entitiesById.get(candidate.item))
        .filter((candidate): candidate is SimulationEntity => Boolean(candidate && !candidate.isDead));

      for (const target of nearby) {
        if (!this.shouldAttack(attacker, target)) continue;
        if (!this.isOffCooldown(attacker.id, weaponId, now)) continue;

        this.resolveAttack(attacker, target, weaponId, now);
        this.lastAttackAt.set(attacker.id, now);
        break;
      }
    }
  }

  public equip(agentId: string, weaponId: WeaponId): void {
    this.equippedWeapons.set(agentId, weaponId);
    simulationEvents.emit(GameEventNames.COMBAT_WEAPON_EQUIPPED, {
      agentId,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatWeaponEquippedLog>({
        type: "weapon_equipped",
        agentId,
        weapon: weaponId,
      }),
    );
  }

  public getEquipped(agentId: string): WeaponId {
    return this.equippedWeapons.get(agentId) ?? "unarmed";
  }

  public craftWeapon(agentId: string, weaponId: WeaponId): boolean {
    const cost = WEAPON_COSTS[weaponId];
    if (!cost) return false;

    const inventory = this.inventorySystem.getAgentInventory(agentId) ?? this.inventorySystem.initializeAgentInventory(agentId);

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
    simulationEvents.emit(GameEventNames.COMBAT_WEAPON_CRAFTED, {
      agentId,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatWeaponCraftedLog>({
        type: "weapon_crafted",
        agentId,
        weapon: weaponId,
      }),
    );
    return true;
  }

  private shouldAttack(attacker: SimulationEntity, target: SimulationEntity): boolean {
    if (attacker.id === target.id) return false;
    if (target.isDead || target.immortal) return false;

    const targetIsAnimal = target.type === "animal" || target.tags?.includes("animal");
    if (targetIsAnimal) return true;

    const attackerProfile = this.lifeCycleSystem.getAgent(attacker.id);
    const targetProfile = this.lifeCycleSystem.getAgent(target.id);
    if (!attackerProfile || !targetProfile) {
      return false;
    }

    const affinity = this.socialSystem.getAffinityBetween(attacker.id, target.id);
    if (affinity <= -0.4) {
      return true;
    }

    const aggression = attackerProfile.traits?.aggression ?? attacker.traits?.aggression ?? 0.3;
    if (aggression < 0.6) return false;

    return Math.random() < aggression * 0.25;
  }

  private isOffCooldown(agentId: string, weaponId: WeaponId, now: number): boolean {
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
    const weapon = getWeapon(weaponId);
    const targetStats = this.ensureStats(target);
    const attackerStats = this.ensureStats(attacker);
    const attackerProfile = this.lifeCycleSystem.getAgent(attacker.id);
    const aggression = attackerProfile?.traits?.aggression ?? attacker.traits?.aggression ?? 0.3;

    const base = weapon.baseDamage * (0.8 + Math.random() * 0.4);
    const scale = 0.5 + aggression * 0.7;
    const crit = Math.random() < weapon.critChance;
    const damage = Math.max(1, Math.round(base * scale * (crit ? weapon.critMultiplier : 1)));

    const newHealth = Math.max(0, (targetStats.health ?? 100) - damage);

    simulationEvents.emit(GameEventNames.COMBAT_ENGAGED, {
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
        type: "engaged",
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

    simulationEvents.emit(GameEventNames.COMBAT_HIT, {
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
        type: "hit",
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
    stats.stress = Math.min(100, (stats.stress ?? 40) + Math.round(damage * 0.4));
    stats.wounds = Math.min(100, (stats.wounds ?? 0) + Math.round(damage * 0.5));
    stats.stamina = Math.max(0, (stats.stamina ?? 60) - Math.round(damage * 0.3));
  }

  private handleKill(attacker: SimulationEntity, target: SimulationEntity, weaponId: WeaponId): void {
    target.isDead = true;
    const entityList = this.state.entities as SimulationEntity[];
    const idx = entityList.findIndex((entity) => entity.id === target.id);
    if (idx >= 0) {
      entityList[idx] = target;
    }

    this.lifeCycleSystem.removeAgent(target.id);

    this.equippedWeapons.delete(target.id);

    simulationEvents.emit(GameEventNames.COMBAT_KILL, {
      attackerId: attacker.id,
      targetId: target.id,
      weapon: weaponId,
    });
    this.appendLog(
      this.createLogEntry<CombatKillLog>({
        type: "kill",
        attackerId: attacker.id,
        targetId: target.id,
        weapon: weaponId,
      }),
    );

    if (target.tags?.includes("animal") || target.type === "animal") {
      simulationEvents.emit(GameEventNames.ANIMAL_HUNTED, {
        animalId: target.id,
        hunterId: attacker.id,
      });
    }
  }

  private ensureStats(entity: SimulationEntity): EntityStats {
    if (!entity.stats) {
      entity.stats = { health: 100, morale: 60, stress: 40, stamina: 50, wounds: 0 };
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
}
