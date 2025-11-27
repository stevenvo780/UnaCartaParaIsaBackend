import type { GameState, Zone } from "../../types/game-types.js";
import type {
  EconomyConfig,
  ResourceType,
} from "../../types/simulation/economy";
import { ResourceType as ResourceTypeEnum } from "../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
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
  },
  salaryRates: {
    wood: 5,
    stone: 8,
    food: 10,
    water: 3,
    rare_materials: 20,
  },
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";

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

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.InventorySystem) inventorySystem: InventorySystem,
    @inject(TYPES.SocialSystem) socialSystem: SocialSystem,
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
    this.entityIndex = entityIndex;
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

    if (this.roleSystem && this.state.agents) {
      const activeWorkers = this.state.agents.filter((agent) => {
        const role = this.roleSystem?.getAgentRole(agent.id);
        return role && role.roleType !== undefined;
      }).length;
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
      if (agent.isDead) continue; // Skip dead agents

      const role = this.roleSystem.getAgentRole(agent.id);
      if (!role || !role.roleType) continue;

      let baseSalary = 10;
      switch (role.roleType) {
        case "farmer":
        case "quarryman":
        case "logger":
          baseSalary = 15;
          break;
        case "builder":
        case "craftsman":
          baseSalary = 20;
          break;
        case "guard":
        case "leader":
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

      if (agent.stats) {
        const currentMoney =
          typeof agent.stats.money === "number" ? agent.stats.money : 0;
        agent.stats.money = currentMoney + baseSalary;
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

    const agent =
      this.entityIndex?.getEntity(agentId) ??
      this.state.entities.find((e) => e.id === agentId);
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
          role.roleType === "farmer" &&
          resourceType === ResourceTypeEnum.FOOD
        )
          teamBonus += 0.5;
        if (
          role.roleType === "quarryman" &&
          resourceType === ResourceTypeEnum.STONE
        )
          teamBonus += 0.8;
        if (
          role.roleType === "logger" &&
          resourceType === ResourceTypeEnum.WOOD
        )
          teamBonus += 0.6;
        if (
          role.roleType === "gatherer" &&
          (resourceType === "water" || resourceType === "food")
        )
          teamBonus += 0.3;
        if (
          role.roleType === "builder" &&
          (resourceType === "wood" || resourceType === "stone")
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

      if (agent.stats) {
        const currentMoney =
          typeof agent.stats.money === "number" ? agent.stats.money : 0;
        agent.stats.money = currentMoney + salary;
      }

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
          teamBonus += 0.05; // 5% bonus per team member
        }
      }
    }

    return Math.min(teamBonus, 1.5); // Cap at 50% bonus
  }

  private addToGlobalResources(resourceType: string, amount: number): void {
    if (resourceType in this.state.resources.materials) {
      this.state.resources.materials[
        resourceType as keyof typeof this.state.resources.materials
      ] += amount;
    }
  }
}
