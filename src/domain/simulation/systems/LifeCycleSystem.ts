import { logger } from "../../../infrastructure/utils/logger";
import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import {
  AgentProfile,
  AgentTraits,
  LifeStage,
  Sex,
  SocialStatus,
} from "../../types/simulation/agents";
import { simulationEvents, GameEventNames } from "../core/events";
import type { SimulationEntity, EntityTraits } from "../core/schema";
import type {
  INeedsPort,
  IAIPort,
  IInventoryPort,
  ISocialPort,
  IHouseholdPort,
  IMovementPort,
} from "../ports";
import type { MarriageSystem } from "./MarriageSystem";
import type { GenealogySystem } from "./GenealogySystem";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { RoleSystem } from "./RoleSystem";
import { RandomUtils } from "../../../shared/utils/RandomUtils";

interface LifeCycleConfig {
  secondsPerYear: number;
  adultAge: number;
  elderAge: number;
  maxAge: number;
  reproductionCooldownSec: number;
  maxPopulation: number;
  fertilityMinAge: number;
  fertilityMaxAge: number;
  godMaxChildren: number;
  godInterbirthSec: number;
  mortalInterbirthSec: number;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";
import type { TaskSystem } from "./TaskSystem";

/**
 * System for managing agent lifecycle: birth, aging, death, and reproduction.
 *
 * Features:
 * - Age progression with life stages (child, adult, elder)
 * - Reproduction with fertility windows and cooldowns
 * - Death handling with respawn support
 * - Resource consumption over time
 * - Role assignment on reaching adulthood
 * - Housing assignment for new agents
 *
 * @see GenealogySystem for family tree tracking
 * @see HouseholdSystem for housing management
 */
@injectable()
export class LifeCycleSystem extends EventEmitter {
  private gameState: GameState;
  private config: LifeCycleConfig;
  private lastResourceConsumption: number = 0;
  private lastRoleRebalance = 0;

  private reproductionCooldown = new Map<string, number>();
  private spawnCounter = 0;
  private pendingHousingAssignments = new Set<string>();

  private needsSystem?: INeedsPort;
  private _aiSystem?: IAIPort;
  private inventorySystem?: IInventoryPort;
  private householdSystem?: IHouseholdPort;
  private _socialSystem?: ISocialPort;
  private _marriageSystem?: MarriageSystem;
  private _genealogySystem?: GenealogySystem;
  private _divineFavorSystem?: DivineFavorSystem;
  private _movementSystem?: IMovementPort;
  private _roleSystem?: RoleSystem;
  private _taskSystem?: TaskSystem;
  private dependenciesChecked = false;
  private entityIndex?: EntityIndex;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
  ) {
    super();
    this.gameState = gameState;
    this.entityIndex = entityIndex;
    this.config = {
      secondsPerYear: 30,
      adultAge: 16,
      elderAge: 55,
      maxAge: 85,
      reproductionCooldownSec: 30,
      maxPopulation: 50,
      fertilityMinAge: 18,
      fertilityMaxAge: 45,
      godMaxChildren: 6,
      godInterbirthSec: 600,
      mortalInterbirthSec: 240,
    };

    this.setupDeathListener();
  }

  /**
   * Sets up a listener for AGENT_DEATH events from NeedsSystem.
   * Ensures that when an agent dies from starvation/dehydration/exhaustion,
   * they are properly removed and cleaned up.
   */
  private setupDeathListener(): void {
    simulationEvents.on(
      GameEventNames.AGENT_DEATH,
      (data: { agentId?: string; entityId?: string; cause?: string }) => {
        const agentId = data.agentId || data.entityId;
        if (!agentId) return;

        // Check if this is a needs-based death (starvation, dehydration, exhaustion)
        // that hasn't been cleaned up yet
        const agentStillExists = this.gameState.agents?.find(
          (a) => a.id === agentId,
        );
        if (agentStillExists) {
          logger.debug(
            `🔄 LifeCycleSystem: Processing deferred death for ${agentId} (${data.cause || "unknown"})`,
          );
          this.removeAgent(agentId);
        }
      },
    );
  }

  public setDependencies(systems: {
    needsSystem?: INeedsPort;
    aiSystem?: IAIPort;
    inventorySystem?: IInventoryPort;
    socialSystem?: ISocialPort;
    marriageSystem?: MarriageSystem;
    genealogySystem?: GenealogySystem;
    householdSystem?: IHouseholdPort;
    divineFavorSystem?: DivineFavorSystem;
    movementSystem?: IMovementPort;
    roleSystem?: RoleSystem;
    taskSystem?: TaskSystem;
  }): void {
    if (systems.needsSystem) this.needsSystem = systems.needsSystem;
    if (systems.aiSystem) this._aiSystem = systems.aiSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this._socialSystem = systems.socialSystem;
    if (systems.marriageSystem) this._marriageSystem = systems.marriageSystem;
    if (systems.genealogySystem)
      this._genealogySystem = systems.genealogySystem;
    if (systems.householdSystem) this.householdSystem = systems.householdSystem;
    if (systems.divineFavorSystem)
      this._divineFavorSystem = systems.divineFavorSystem;
    if (systems.movementSystem) this._movementSystem = systems.movementSystem;
    if (systems.taskSystem) this._taskSystem = systems.taskSystem;
    if (systems.roleSystem) {
      this._roleSystem = systems.roleSystem;
      this.assignRolesToEligibleAdults();
    }
  }

  private checkDependencies(): void {
    if (this.dependenciesChecked) {
      return;
    }
    const missing: string[] = [];
    if (!this.needsSystem) missing.push("NeedsSystem");
    if (!this._aiSystem) missing.push("AISystem");
    if (!this.inventorySystem) missing.push("InventorySystem");
    if (!this.householdSystem) missing.push("HouseholdSystem");
    if (!this._socialSystem) missing.push("SocialSystem");
    if (!this._marriageSystem) missing.push("MarriageSystem");
    if (!this._genealogySystem) missing.push("GenealogySystem");
    if (!this._divineFavorSystem) missing.push("DivineFavorSystem");
    if (!this._movementSystem) missing.push("MovementSystem");
    if (!this._roleSystem) missing.push("RoleSystem");
    if (!this._taskSystem) missing.push("TaskSystem");
    if (missing.length > 0) {
      logger.warn(
        `LifeCycleSystem: missing dependencies -> ${missing.join(", ")}`,
      );
    }
    this.dependenciesChecked = true;
  }

  public update(deltaTimeMs: number): void {
    if (!this.dependenciesChecked) {
      this.checkDependencies();
    }
    const dtSec = deltaTimeMs / 1000;

    this.lastResourceConsumption += deltaTimeMs;
    if (this.lastResourceConsumption >= 60000) {
      this.consumeResourcesPeriodically();
      this.lastResourceConsumption = 0;
    }

    const yearInc = dtSec / this.config.secondsPerYear;
    const agents = this.gameState.agents || [];

    for (const agent of agents) {
      const previousStage = agent.lifeStage;
      agent.ageYears += yearInc;
      agent.lifeStage = this.getLifeStage(agent.ageYears);

      if (previousStage !== agent.lifeStage) {
        simulationEvents.emit(GameEventNames.AGENT_AGED, {
          entityId: agent.id,
          newAge: agent.ageYears,
          previousStage,
          currentStage: agent.lifeStage,
        });
      }

      if (!agent.immortal && agent.ageYears > this.config.maxAge) {
        this.removeAgent(agent.id);
        continue;
      }

      if (agent.lifeStage === "adult") {
        this.queueHousingAssignment(agent.id);
      }
    }

    this.tryBreeding(Date.now());
    this.processHousingAssignments();

    // Periodic role rebalancing
    const now = Date.now();
    const ROLE_REBALANCE_INTERVAL = 120000; // Every 2 minutes
    if (!this.lastRoleRebalance) {
      this.lastRoleRebalance = now;
    }
    if (
      now - this.lastRoleRebalance >= ROLE_REBALANCE_INTERVAL &&
      this._roleSystem
    ) {
      this.rebalanceRolesIfNeeded();
      this.lastRoleRebalance = now;
    }
  }

  private rebalanceRolesIfNeeded(): void {
    if (!this._roleSystem || !this.inventorySystem) return;

    // Calculate collective state
    type StockpileItem = {
      inventory: {
        food?: number;
        water?: number;
        wood?: number;
        stone?: number;
      };
    };
    // Call getAllStockpiles directly on the object to preserve 'this' context
    const invSystem = this.inventorySystem as {
      getAllStockpiles?: () => StockpileItem[];
    };
    const stockpiles: StockpileItem[] = invSystem.getAllStockpiles?.() || [];
    const population = (this.gameState.agents || []).length;

    let totalFood = 0,
      totalWater = 0,
      totalWood = 0,
      totalStone = 0;

    for (const sp of stockpiles) {
      totalFood += sp.inventory.food || 0;
      totalWater += sp.inventory.water || 0;
      totalWood += sp.inventory.wood || 0;
      totalStone += sp.inventory.stone || 0;
    }

    const collectiveState = {
      foodPerCapita: totalFood / Math.max(1, population),
      waterPerCapita: totalWater / Math.max(1, population),
      totalWood,
      totalStone,
      population,
    };

    this._roleSystem.rebalanceRoles(collectiveState);
  }

  public getLifeStage(age: number): LifeStage {
    if (age < this.config.adultAge) return LifeStage.CHILD;
    if (age < this.config.elderAge) return LifeStage.ADULT;
    return LifeStage.ELDER;
  }

  private queueHousingAssignment(agentId: string): void {
    const agent = this.getAgent(agentId);
    if (!agent) return;

    const householdId = this.householdSystem?.getHouseFor(agent.id)?.id;
    if (householdId) {
      const currentHouse = this.householdSystem?.getHouseFor(agent.id);
      if (!currentHouse) {
        this.householdSystem?.assignToHouse(agent.id, householdId);
      }
      return;
    }
    this.pendingHousingAssignments.add(agentId);
  }

  private processHousingAssignments(): void {
    if (!this.householdSystem) return;

    let processed = 0;
    for (const agentId of this.pendingHousingAssignments) {
      if (processed >= 3) break;

      const agent =
        this.entityIndex?.getAgent(agentId) ??
        this.gameState.agents?.find((a) => a.id === agentId);
      if (agent && agent.lifeStage === "adult") {
        const assigned = this.householdSystem?.assignToHouse(agent.id);
        if (assigned) {
          this.pendingHousingAssignments.delete(agentId);
        }
      } else {
        this.pendingHousingAssignments.delete(agentId);
      }
      processed++;
    }
  }

  private consumeResourcesPeriodically(): void {
    if (this.inventorySystem) {
      const agents = this.gameState.agents || [];
      for (const agent of agents) {
        const foodConsumed = this.inventorySystem.consumeFromAgent(agent.id, {
          food: 1,
        });
        const waterConsumed = this.inventorySystem.consumeFromAgent(agent.id, {
          water: 1,
        });

        // Connect consumption to needs satisfaction
        if (foodConsumed && this.needsSystem) {
          const needs = this.needsSystem.getNeeds(agent.id);
          if (needs) {
            needs.hunger = Math.min(100, needs.hunger + 10);
          }
        }

        if (waterConsumed && this.needsSystem) {
          const needs = this.needsSystem.getNeeds(agent.id);
          if (needs) {
            needs.thirst = Math.min(100, needs.thirst + 10);
          }
        }
      }
    }
  }

  private lastBreedingCheck = 0;
  private readonly BREEDING_CHECK_INTERVAL = 60000; // Check every minute

  private async tryBreeding(now: number): Promise<void> {
    if (now - this.lastBreedingCheck < this.BREEDING_CHECK_INTERVAL) return;
    this.lastBreedingCheck = now;

    const agents = this.gameState.agents || [];
    const agentNames = agents
      .map((a) => `${a.name}(${a.id},${a.lifeStage},${a.sex})`)
      .join(", ");
    logger.debug(
      `🍼 [Breeding] Checking... pop=${agents.length}/${this.config.maxPopulation} agents=[${agentNames}]`,
    );

    if (agents.length >= this.config.maxPopulation) {
      logger.debug(`🍼 [Breeding] SKIP: max population reached`);
      return;
    }

    const adults = agents.filter((a) => a.lifeStage === "adult");
    const males = adults.filter((a) => a.sex === "male");
    const females = adults.filter((a) => a.sex === "female");

    logger.debug(
      `🍼 [Breeding] adults=${adults.length} males=${males.length} females=${females.length}`,
    );

    if (males.length === 0 || females.length === 0) {
      logger.debug(
        `🍼 [Breeding] SKIP: need at least 1 male and 1 female adult`,
      );
      return;
    }

    if (RandomUtils.chance(0.6)) {
      const father = RandomUtils.element(males);
      const mother = RandomUtils.element(females);

      if (father && mother) {
        await this.tryCouple(father.id, mother.id, now);
      }
    }
  }

  private async tryCouple(
    fatherId: string,
    motherId: string,
    now: number,
  ): Promise<void> {
    const pairKey = [fatherId, motherId].sort().join("::");
    const cooldown = this.reproductionCooldown.get(pairKey) || 0;

    if (now < cooldown) {
      logger.debug(
        `🍼 [tryCouple] ${fatherId}+${motherId} SKIP: cooldown (${Math.round((cooldown - now) / 1000)}s left)`,
      );
      return;
    }

    const father =
      this.entityIndex?.getAgent(fatherId) ??
      this.gameState.agents?.find((a) => a.id === fatherId);
    const mother =
      this.entityIndex?.getAgent(motherId) ??
      this.gameState.agents?.find((a) => a.id === motherId);

    if (!father || !mother) {
      logger.debug(
        `🍼 [tryCouple] ${fatherId}+${motherId} SKIP: agents not found`,
      );
      return;
    }

    // Verify needs before reproduction
    if (this.needsSystem) {
      const motherNeeds = this.needsSystem.getNeeds(motherId);
      const fatherNeeds = this.needsSystem.getNeeds(fatherId);

      logger.debug(
        `🍼 [tryCouple] ${father.name}+${mother.name} needs: ` +
          `father(hunger=${fatherNeeds?.hunger?.toFixed(0)}, energy=${fatherNeeds?.energy?.toFixed(0)}) ` +
          `mother(hunger=${motherNeeds?.hunger?.toFixed(0)}, energy=${motherNeeds?.energy?.toFixed(0)})`,
      );

      if (
        !motherNeeds ||
        !fatherNeeds ||
        motherNeeds.hunger < 60 ||
        fatherNeeds.hunger < 60 ||
        motherNeeds.energy < 50 ||
        fatherNeeds.energy < 50
      ) {
        logger.debug(
          `🍼 [tryCouple] ${father.name}+${mother.name} SKIP: needs too low (req: hunger>=60, energy>=50)`,
        );
        return; // Don't reproduce if needs are low
      }
    }

    logger.info(`🍼 [tryCouple] ${father.name}+${mother.name} REPRODUCING!`);

    simulationEvents.emit(GameEventNames.REPRODUCTION_ATTEMPT, {
      parent1: fatherId,
      parent2: motherId,
      timestamp: now,
    });

    const childId = await this.spawnAgent({
      generation: Math.max(father.generation, mother.generation) + 1,
      parents: { father: fatherId, mother: motherId },
      sex: RandomUtils.chance(0.5) ? Sex.MALE : Sex.FEMALE,
    });

    this.reproductionCooldown.set(
      pairKey,
      now + this.config.reproductionCooldownSec * 1000,
    );

    simulationEvents.emit(GameEventNames.REPRODUCTION_SUCCESS, {
      childId,
      parent1: fatherId,
      parent2: motherId,
    });
  }

  public spawnAgent(
    spec:
      | Partial<AgentProfile>
      | {
          id?: string;
          name?: string;
          sex: Sex;
          ageYears: number;
          lifeStage: LifeStage;
          generation: number;
          immortal?: boolean;
          traits?: Partial<AgentTraits>;
        } = {},
  ): AgentProfile {
    const partial = spec as Partial<AgentProfile>;
    const id = partial.id ?? `agent_${++this.spawnCounter}`;
    logger.info(`🧑 Spawning agent ${id} (${partial.name || "unnamed"})`);

    let traits = this.randomTraits();
    if (partial.parents?.father && partial.parents?.mother) {
      traits = this.inheritTraits(
        partial.parents.father,
        partial.parents.mother,
      );
    }

    const profile: AgentProfile = {
      id,
      name: partial.name || `Agent ${id}`,
      sex: partial.sex || Sex.FEMALE,
      ageYears: 0,
      lifeStage: LifeStage.CHILD,
      generation: partial.generation || 0,
      birthTimestamp: Date.now(),
      immortal: false,
      traits,
      socialStatus: SocialStatus.COMMONER,
      ...partial,
    };

    const world = this.gameState.worldSize ?? { width: 2000, height: 2000 };
    if (!profile.position) {
      profile.position = this.findValidSpawnPosition(world);
    } else {
      if (!this.isPositionValid(profile.position, world)) {
        profile.position = this.findValidSpawnPosition(world);
      }
    }

    if (!this.gameState.agents) this.gameState.agents = [];
    this.gameState.agents.push(profile);

    if (profile.position) {
      if (!this.gameState.entities) {
        this.gameState.entities = [];
      }
      const existingEntity =
        this.entityIndex?.getEntity(id) ??
        this.gameState.entities.find((e) => e.id === id);
      if (!existingEntity) {
        const entity: SimulationEntity = {
          id,
          name: profile.name,
          x: profile.position.x,
          y: profile.position.y,
          position: { ...profile.position },
          isDead: false,
          type: "agent",
          traits: profile.traits as EntityTraits,
          immortal: profile.immortal,
          stats: {
            health: 100,
            stamina: 100,
          },
        };
        this.gameState.entities.push(entity);

        // Update EntityIndex immediately so listeners can find the new agent/entity
        if (this.entityIndex) {
          this.entityIndex.setAgent(profile);
          this.entityIndex.setEntity(entity);
        }
      }
    } else if (this.entityIndex) {
      // Even if no position (unlikely), register agent
      this.entityIndex.setAgent(profile);
    }

    if (this.needsSystem) {
      this.needsSystem.initializeEntityNeeds(id);
    }
    if (this.inventorySystem) {
      this.inventorySystem.initializeAgentInventory(id);
    }
    if (profile.position) {
      this._movementSystem?.moveToPoint(
        id,
        profile.position.x,
        profile.position.y,
      );
    }

    if (this._genealogySystem) {
      this._genealogySystem.registerBirth(
        profile,
        profile.parents?.father,
        profile.parents?.mother,
      );
    }

    if (
      this._roleSystem &&
      (profile.lifeStage === "adult" || profile.lifeStage === "elder")
    ) {
      const existingRole = this._roleSystem.getAgentRole(id);
      if (!existingRole) {
        this._roleSystem.assignBestRole(profile);
      }
    }

    simulationEvents.emit(GameEventNames.AGENT_BIRTH, {
      entityId: id,
      parentIds: profile.parents
        ? [profile.parents.father, profile.parents.mother]
        : undefined,
    });

    return profile;
  }

  private assignRolesToEligibleAdults(): void {
    if (!this._roleSystem) return;

    const agents = this.gameState.agents || [];
    for (const agent of agents) {
      if (agent.lifeStage === "adult" || agent.lifeStage === "elder") {
        const role = this._roleSystem.getAgentRole(agent.id);
        if (!role) {
          this._roleSystem.assignBestRole(agent);
        }
      }
    }
  }

  private randomTraits(): AgentTraits {
    return {
      cooperation: RandomUtils.float(),
      diligence: RandomUtils.float(),
      curiosity: RandomUtils.float(),
      aggression: RandomUtils.float(),
    };
  }

  private inheritTraits(fatherId: string, motherId: string): AgentTraits {
    const father = this.getAgent(fatherId);
    const mother = this.getAgent(motherId);

    if (!father || !mother) return this.randomTraits();

    const mix = (a: number, b: number): number => {
      const base = (a + b) / 2;
      const mutation = (RandomUtils.float() - 0.5) * 0.2;
      return Math.max(0, Math.min(1, base + mutation));
    };

    return {
      cooperation: mix(father.traits.cooperation, mother.traits.cooperation),
      aggression: mix(father.traits.aggression, mother.traits.aggression),
      diligence: mix(father.traits.diligence, mother.traits.diligence),
      curiosity: mix(father.traits.curiosity, mother.traits.curiosity),
    };
  }

  public getAgent(id: string): AgentProfile | undefined {
    return (
      this.entityIndex?.getAgent(id) ??
      this.gameState.agents?.find((a) => a.id === id)
    );
  }

  public getAgents(): AgentProfile[] {
    return this.gameState.agents || [];
  }

  public removeAgent(id: string): void {
    if (!this.gameState.agents) return;

    const index = this.gameState.agents.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.gameState.agents.splice(index, 1);
      if (this.gameState.entities) {
        const entityIndex = this.gameState.entities.findIndex(
          (e) => e.id === id,
        );
        if (entityIndex !== -1) {
          this.gameState.entities[entityIndex].isDead = true;
        }
      }

      this.cleanupAgentState(id);

      simulationEvents.emit(GameEventNames.AGENT_DEATH, {
        entityId: id,
        reason: "removed",
      });
    }
  }

  /**
   * Cleans up all agent-related state across all systems.
   *
   * @param agentId - Agent ID to clean up
   */
  private cleanupAgentState(agentId: string): void {
    const agent =
      this.entityIndex?.getAgent(agentId) ??
      this.gameState.agents?.find((a) => a.id === agentId);

    if (this.inventorySystem) {
      const inv = this.inventorySystem.getAgentInventory(agentId);
      if (
        inv &&
        (inv.wood > 0 || inv.stone > 0 || inv.food > 0 || inv.water > 0)
      ) {
        simulationEvents.emit(GameEventNames.INVENTORY_DROPPED, {
          agentId,
          position: agent?.position,
          inventory: {
            wood: inv.wood,
            stone: inv.stone,
            food: inv.food,
            water: inv.water,
          },
          timestamp: Date.now(),
        });
      }
      this.inventorySystem.removeAgentInventory(agentId);
    }

    if (this._aiSystem) {
      this._aiSystem.removeAgentState(agentId);
    }

    if (this.needsSystem) {
      this.needsSystem.removeEntityNeeds(agentId);
    }

    if (this._socialSystem) {
      this._socialSystem.removeRelationships(agentId);
    }

    if (this._movementSystem) {
      this._movementSystem.removeEntityMovement(agentId);
    }

    if (this._taskSystem) {
      this._taskSystem.removeAgentFromAllTasks(agentId);
    }

    if (this._roleSystem) {
      this._roleSystem.removeAgentRole(agentId);
    }

    if (this.householdSystem) {
      this.householdSystem.removeAgentFromHousehold(agentId);
    }

    if (this._genealogySystem) {
      this._genealogySystem.recordDeath(agentId);
    }
  }

  public killAgent(id: string): boolean {
    if (!this.gameState.agents) return false;
    const index = this.gameState.agents.findIndex((a) => a.id === id);
    if (index === -1) return false;

    this.gameState.agents.splice(index, 1);

    this.cleanupAgentState(id);

    simulationEvents.emit(GameEventNames.AGENT_DEATH, {
      entityId: id,
      reason: "killed",
    });

    return true;
  }

  /**
   * Encuentra una posición válida para spawn de agentes
   * Valida que no esté en agua, dentro de edificios, o fuera de límites
   */
  private findValidSpawnPosition(world: { width: number; height: number }): {
    x: number;
    y: number;
  } {
    const MAX_ATTEMPTS = 100;
    const SPAWN_RADIUS = 200;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x =
        Math.floor(world.width / 2) +
        Math.floor((RandomUtils.float() - 0.5) * SPAWN_RADIUS);
      const y =
        Math.floor(world.height / 2) +
        Math.floor((RandomUtils.float() - 0.5) * SPAWN_RADIUS);

      const position = { x, y };
      if (this.isPositionValid(position, world)) {
        return position;
      }
    }

    logger.warn(
      "⚠️ Could not find valid spawn position, using center fallback",
    );
    return {
      x: Math.floor(world.width / 2),
      y: Math.floor(world.height / 2),
    };
  }

  /**
   * Valida si una posición es válida para spawn
   */
  private isPositionValid(
    position: { x: number; y: number },
    world: { width: number; height: number },
  ): boolean {
    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= world.width ||
      position.y >= world.height
    ) {
      return false;
    }

    if (this.gameState.terrainTiles) {
      const nearbyWater = this.gameState.terrainTiles.some((tile) => {
        const dx = tile.x - position.x;
        const dy = tile.y - position.y;
        const dist = Math.hypot(dx, dy);
        return dist < 32 && tile.type === "water";
      });

      if (nearbyWater) {
        return false;
      }

      const nearbyTile = this.gameState.terrainTiles.find((tile) => {
        const dx = Math.abs(tile.x - position.x);
        const dy = Math.abs(tile.y - position.y);
        return dx < 16 && dy < 16;
      });

      if (nearbyTile && nearbyTile.isWalkable === false) {
        return false;
      }
    }

    if (this.gameState.zones) {
      const insideZone = this.gameState.zones.some((zone) => {
        if (!zone.bounds) return false;
        return (
          position.x >= zone.bounds.x &&
          position.x <= zone.bounds.x + zone.bounds.width &&
          position.y >= zone.bounds.y &&
          position.y <= zone.bounds.y + zone.bounds.height &&
          zone.metadata?.underConstruction === true
        );
      });

      if (insideZone) {
        return false;
      }
    }

    return true;
  }
}
