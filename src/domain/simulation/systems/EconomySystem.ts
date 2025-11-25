import type { GameState, Zone } from "../../types/game-types.js";
import type {
  EconomyConfig,
  ResourceType,
} from "../../types/simulation/economy";
import { InventorySystem } from "./InventorySystem.js";
import { SocialSystem } from "./SocialSystem.js";
import { RoleSystem } from "./RoleSystem.js";
import { DivineFavorSystem } from "./DivineFavorSystem.js";
import { GenealogySystem } from "./GenealogySystem.js";
import { simulationEvents, GameEventNames } from "../core/events.js";

const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  workDurationMs: 5000,
  baseYield: {
    wood: 1.5,
    stone: 1,
    food: 2,
    water: 3,
  },
  salaryRates: {
    wood: 5,
    stone: 8,
    food: 10,
    water: 3,
  },
};

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

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
  private lastUpdate = 0;
  private readonly UPDATE_INTERVAL_MS = 10000; // Update every 10 seconds
  private lastSalaryPayment = 0;
  private readonly SALARY_INTERVAL_MS = 60000; // Pay salaries every minute

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.InventorySystem) inventorySystem: InventorySystem,
    @inject(TYPES.SocialSystem) socialSystem: SocialSystem,
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
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
    const _maxAge = 3600000;
    const _now = Date.now();

    if (this.yieldResiduals.size > 100) {
      const entries = Array.from(this.yieldResiduals.entries());
      this.yieldResiduals.clear();
      entries.slice(-50).forEach(([key, value]) => {
        this.yieldResiduals.set(key, value);
      });
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
      const role = this.roleSystem.getAgentRole(agent.id);
      if (!role || !role.roleType) continue;

      // Base salary based on role
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

    const agent = this.state.entities.find((e) => e.id === agentId);
    if (!agent) return;

    let resourceType: ResourceType | null = null;
    let baseYield = 0;

    switch (zone.type) {
      case "work": {
        const res = zone.props?.resource;
        if (res === "wood") {
          resourceType = "wood";
          baseYield = this.config.baseYield.wood;
        } else if (res === "stone") {
          resourceType = "stone";
          baseYield = this.config.baseYield.stone;
        }
        break;
      }
      case "food":
        resourceType = "food";
        baseYield = this.config.baseYield.food;
        break;
      case "water":
        resourceType = "water";
        baseYield = this.config.baseYield.water;
        break;
    }

    if (!resourceType || baseYield === 0) return;

    const teamBonus = this.computeTeamBonus(agentId, zone);
    let totalYield = baseYield * teamBonus;

    // Role Bonus
    if (this.roleSystem) {
      const role = this.roleSystem.getAgentRole(agentId);
      if (role?.roleType) {
        // Simplified role bonus logic
        if (role.roleType === "farmer" && resourceType === "food")
          totalYield *= 1.5;
        if (role.roleType === "quarryman" && resourceType === "stone")
          totalYield *= 1.8;
        if (role.roleType === "logger" && resourceType === "wood")
          totalYield *= 1.6;
        if (
          role.roleType === "gatherer" &&
          (resourceType === "water" || resourceType === "food")
        )
          totalYield *= 1.3;
        if (
          role.roleType === "builder" &&
          (resourceType === "wood" || resourceType === "stone")
        )
          totalYield *= 1.3;
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
        totalYield *= productivityMult;
      }
    }

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
