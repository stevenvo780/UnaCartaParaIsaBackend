import type { GameState, Zone } from "../../types/game-types.js";
import type {
  EconomyConfig,
  ResourceType,
} from "../../types/simulation/economy";
import { ResourceType as ResourceTypeEnum } from "../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { RoleType } from "../../../shared/constants/RoleEnums";
import { InventorySystem } from "./InventorySystem";
import { SocialSystem } from "./SocialSystem";
import { RoleSystem } from "./RoleSystem";
import { DivineFavorSystem } from "./DivineFavorSystem";
import { GenealogySystem } from "./GenealogySystem";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "../../../infrastructure/utils/logger";

const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  workDurationMs: 5000,
  baseYield: {
    wood: 1.5,
    stone: 1,
    food: 2,
    water: 3,
    rare_materials: 0.5,
    metal: 1,
  },
  salaryRates: {
    wood: 5,
    stone: 8,
    food: 10,
    water: 3,
    rare_materials: 20,
    metal: 10,
  },
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";
import type { AgentRegistry } from "../core/AgentRegistry";

/**
 * System for managing economic activities: resource production, salaries, and work yields.
 *
 * Features:
 * - Resource yield calculations based on work duration
 * - Salary payment system for agents with roles
 * - Yield residuals for fractional resource accumulation
 * - Integration with role system for work assignments
 * - Divine favor modifiers for production bonuses
 *
 * @see RoleSystem for agent role assignments
 * @see InventorySystem for resource storage
 */
@injectable()
export class EconomySystem {
  private state: GameState;
  private inventorySystem: InventorySystem;
  private socialSystem: SocialSystem;
  private roleSystem?: RoleSystem;
  private divineFavorSystem?: DivineFavorSystem;
  private genealogySystem?: GenealogySystem;
  private config: EconomyConfig;
  private yieldResiduals = new Map<string, number>();
  private lastUpdate = Date.now();
  private readonly UPDATE_INTERVAL_MS = 10000;
  private lastSalaryPayment = 0;
  private readonly SALARY_INTERVAL_MS = 60000;
  private entityIndex?: EntityIndex;
  private agentRegistry?: AgentRegistry;

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.InventorySystem) inventorySystem: InventorySystem,
    @inject(TYPES.SocialSystem) socialSystem: SocialSystem,
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
    @inject(TYPES.AgentRegistry) @optional() agentRegistry?: AgentRegistry,
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
    this.entityIndex = entityIndex;
    this.agentRegistry = agentRegistry;
    this.config = DEFAULT_ECONOMY_CONFIG;
  }

  public setDependencies(deps: {
    roleSystem?: RoleSystem;
    divineFavorSystem?: DivineFavorSystem;
    genealogySystem?: GenealogySystem;
  }): void {
    this.roleSystem = deps.roleSystem;
    this.divineFavorSystem = deps.divineFavorSystem;
    this.genealogySystem = deps.genealogySystem;
  }

  public update(_delta: number): void {
    const now = Date.now();

    if (now - this.lastUpdate >= this.UPDATE_INTERVAL_MS) {
      this.cleanupOldResiduals();
      this.updateEconomyStats();
      this.lastUpdate = now;
    }

    if (now - this.lastSalaryPayment >= this.SALARY_INTERVAL_MS) {
      this.processSalaryPayments();
      this.lastSalaryPayment = now;
    }
  }

  private cleanupOldResiduals(): void {
    if (this.yieldResiduals.size > 100) {
      let toDelete = this.yieldResiduals.size - 50;
      for (const key of this.yieldResiduals.keys()) {
        if (toDelete <= 0) break;
        this.yieldResiduals.delete(key);
        toDelete--;
      }
    }
  }

  private updateEconomyStats(): void {
    if (!this.state.economy) {
      this.state.economy = {
        totalWorkActions: 0,
        totalResourcesProduced: {
          wood: 0,
          stone: 0,
          food: 0,
          water: 0,
        },
        averageYield: {
          wood: 0,
          stone: 0,
          food: 0,
          water: 0,
        },
        totalSalariesPaid: 0,
        activeWorkers: 0,
      };
    }

    if (this.roleSystem) {
      let activeWorkers = 0;

      if (this.agentRegistry) {
        for (const agent of this.agentRegistry.getAllProfiles()) {
          const role = this.roleSystem?.getAgentRole(agent.id);
          if (role && role.roleType !== undefined) {
            activeWorkers++;
          }
        }
      } else if (this.state.agents) {
        for (const agent of this.state.agents) {
          const role = this.roleSystem?.getAgentRole(agent.id);
          if (role && role.roleType !== undefined) {
            activeWorkers++;
          }
        }
      }
      this.state.economy.activeWorkers = activeWorkers;
    }

    simulationEvents.emit(GameEventNames.ECONOMY_RESERVATIONS_UPDATE, {
      economy: this.state.economy,
      timestamp: Date.now(),
    });
  }

  private processSalaryPayments(): void {
    if (!this.state.agents || !this.roleSystem) return;

    let totalSalaries = 0;

    for (const agent of this.state.agents) {
      if (agent.isDead) continue;

      const role = this.roleSystem.getAgentRole(agent.id);
      if (!role || !role.roleType) continue;

      let baseSalary = 10;
      switch (role.roleType) {
        case RoleType.FARMER:
        case RoleType.QUARRYMAN:
        case RoleType.LOGGER:
          baseSalary = 15;
          break;
        case RoleType.BUILDER:
        case RoleType.CRAFTSMAN:
          baseSalary = 20;
          break;
        case RoleType.GUARD:
        case RoleType.LEADER:
          baseSalary = 25;
          break;
      }

      if (this.divineFavorSystem && this.genealogySystem) {
        const ancestor = this.genealogySystem.getAncestor(agent.id);
        const lineageId = ancestor?.lineageId || "";
        const salaryMult = this.divineFavorSystem.getMultiplier(
          lineageId,
          "productivity_boost",
        );
        if (salaryMult > 1.0) {
          baseSalary = Math.round(baseSalary * salaryMult);
        }
      }

      if (this.addMoney(agent.id, baseSalary)) {
        totalSalaries += baseSalary;

        simulationEvents.emit(GameEventNames.SALARY_PAID, {
          agentId: agent.id,
          amount: baseSalary,
          role: role.roleType,
          timestamp: Date.now(),
        });
      }
    }

    if (this.state.economy) {
      this.state.economy.totalSalariesPaid =
        (this.state.economy.totalSalariesPaid || 0) + totalSalaries;
    }
  }

  public handleWorkAction(agentId: string, zoneId: string): void {
    const zone = this.state.zones.find((z) => z.id === zoneId);
    if (!zone) return;

    const agent = this.entityIndex?.getEntity(agentId);
    if (!agent) return;

    let resourceType: ResourceType | null = null;
    let baseYield = 0;

    switch (zone.type) {
      case ZoneType.WORK: {
        const res = zone.props?.resource;
        if (res === ResourceTypeEnum.WOOD) {
          resourceType = ResourceTypeEnum.WOOD;
          baseYield = this.config.baseYield.wood;
        } else if (res === ResourceTypeEnum.STONE) {
          resourceType = ResourceTypeEnum.STONE;
          baseYield = this.config.baseYield.stone;
        }
        break;
      }
      case ZoneType.FOOD:
        resourceType = ResourceTypeEnum.FOOD;
        baseYield = this.config.baseYield.food;
        break;
      case ZoneType.WATER:
        resourceType = ResourceTypeEnum.WATER;
        baseYield = this.config.baseYield.water;
        break;
    }

    if (!resourceType || baseYield === 0) return;

    let teamBonus = this.computeTeamBonus(agentId, zone);

    if (this.roleSystem) {
      const role = this.roleSystem.getAgentRole(agentId);
      if (role?.roleType) {
        if (
          role.roleType === RoleType.FARMER &&
          resourceType === ResourceTypeEnum.FOOD
        )
          teamBonus += 0.5;
        if (
          role.roleType === RoleType.QUARRYMAN &&
          resourceType === ResourceTypeEnum.STONE
        )
          teamBonus += 0.8;
        if (
          role.roleType === RoleType.LOGGER &&
          resourceType === ResourceTypeEnum.WOOD
        )
          teamBonus += 0.6;
        if (
          role.roleType === RoleType.GATHERER &&
          (resourceType === ResourceTypeEnum.WATER ||
            resourceType === ResourceTypeEnum.FOOD)
        )
          teamBonus += 0.3;
        if (
          role.roleType === RoleType.BUILDER &&
          (resourceType === ResourceTypeEnum.WOOD ||
            resourceType === ResourceTypeEnum.STONE)
        )
          teamBonus += 0.3;
      }
    }

    if (this.divineFavorSystem && this.genealogySystem) {
      const ancestor = this.genealogySystem.getAncestor(agentId);
      const lineageId = ancestor?.lineageId || "";
      const productivityMult = this.divineFavorSystem.getMultiplier(
        lineageId,
        "productivity_boost",
      );
      if (productivityMult > 1.0) {
        teamBonus += productivityMult - 1.0;
      }
    }

    const totalYield = baseYield * teamBonus;

    const key = `${agentId}:${resourceType}`;
    const residual = this.yieldResiduals.get(key) || 0;
    const amount = Math.floor(totalYield + residual);
    const newResidual = totalYield + residual - amount;
    this.yieldResiduals.set(key, newResidual);

    if (amount > 0) {
      const added = this.inventorySystem.addResource(
        agentId,
        resourceType,
        amount,
      );
      if (!added) {
        this.addToGlobalResources(resourceType, amount);
      }
      const salary = Math.round(
        this.config.salaryRates[resourceType] * teamBonus,
      );

      this.addMoney(agentId, salary);

      logger.debug(
        `⚒️ [ECONOMY] Work: ${agentId} produced ${amount} ${resourceType} (yield: ${totalYield.toFixed(2)}, bonus: ${teamBonus.toFixed(2)})`,
      );
    }
  }

  private computeTeamBonus(agentId: string, zone: Zone): number {
    let teamBonus = 1.0;
    const workerGroup = this.socialSystem.getGroupForAgent(agentId);

    if (workerGroup && zone.bounds) {
      const agentsInZone = this.state.entities.filter((e) => {
        if (!e.position) return false;
        return (
          e.position.x >= zone.bounds.x &&
          e.position.x <= zone.bounds.x + zone.bounds.width &&
          e.position.y >= zone.bounds.y &&
          e.position.y <= zone.bounds.y + zone.bounds.height
        );
      });

      for (const memberId of workerGroup.members) {
        if (memberId === agentId) continue;
        if (agentsInZone.some((e) => e.id === memberId)) {
          teamBonus += 0.05;
        }
      }
    }

    return Math.min(teamBonus, 1.5);
  }

  private addToGlobalResources(resourceType: string, amount: number): void {
    if (resourceType in this.state.resources.materials) {
      this.state.resources.materials[
        resourceType as keyof typeof this.state.resources.materials
      ] += amount;
    }
  }

  /**
   * Gets the current money balance for an agent.
   * @param agentId - The agent's ID
   * @returns The agent's current money balance, or 0 if not found
   */
  public getMoney(agentId: string): number {
    const entity = this.entityIndex?.getEntity(agentId);
    if (!entity?.stats) return 0;
    return typeof entity.stats.money === "number" ? entity.stats.money : 0;
  }

  /**
   * Checks if an agent can afford a specific amount.
   * @param agentId - The agent's ID
   * @param amount - The amount to check
   * @returns True if the agent has sufficient funds
   */
  public canAfford(agentId: string, amount: number): boolean {
    return this.getMoney(agentId) >= amount;
  }

  /**
   * Adds money to an agent's balance.
   * @param agentId - The agent's ID
   * @param amount - The amount to add (must be positive)
   * @returns True if successful, false if entity not found
   */
  public addMoney(agentId: string, amount: number): boolean {
    if (amount < 0) {
      logger.warn(`EconomySystem: Attempted to add negative money: ${amount}`);
      return false;
    }

    const entity = this.entityIndex?.getEntity(agentId);
    if (!entity) return false;

    if (!entity.stats) {
      entity.stats = {};
    }

    const currentMoney =
      typeof entity.stats.money === "number" ? entity.stats.money : 0;
    entity.stats.money = currentMoney + amount;

    simulationEvents.emit(GameEventNames.MONEY_CHANGED, {
      agentId,
      amount,
      newBalance: entity.stats.money,
      type: "add",
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Removes money from an agent's balance.
   * @param agentId - The agent's ID
   * @param amount - The amount to remove (must be positive)
   * @returns True if successful, false if insufficient funds or entity not found
   */
  public removeMoney(agentId: string, amount: number): boolean {
    if (amount < 0) {
      logger.warn(
        `EconomySystem: Attempted to remove negative money: ${amount}`,
      );
      return false;
    }

    const entity = this.entityIndex?.getEntity(agentId);
    if (!entity?.stats) return false;

    const currentMoney =
      typeof entity.stats.money === "number" ? entity.stats.money : 0;
    if (currentMoney < amount) {
      return false;
    }

    entity.stats.money = currentMoney - amount;

    simulationEvents.emit(GameEventNames.MONEY_CHANGED, {
      agentId,
      amount: -amount,
      newBalance: entity.stats.money,
      type: "remove",
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Transfers money between two agents.
   * @param fromId - The sender's ID
   * @param toId - The receiver's ID
   * @param amount - The amount to transfer
   * @returns True if successful
   */
  public transferMoney(fromId: string, toId: string, amount: number): boolean {
    if (!this.canAfford(fromId, amount)) {
      return false;
    }

    if (!this.removeMoney(fromId, amount)) {
      return false;
    }

    if (!this.addMoney(toId, amount)) {
      this.addMoney(fromId, amount);
      return false;
    }

    simulationEvents.emit(GameEventNames.MONEY_TRANSFERRED, {
      fromId,
      toId,
      amount,
      timestamp: Date.now(),
    });

    return true;
  }
}
