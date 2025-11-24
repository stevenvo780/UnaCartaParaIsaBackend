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

export class EconomySystem {
  private state: GameState;
  private inventorySystem: InventorySystem;
  private socialSystem: SocialSystem;
  private roleSystem?: RoleSystem;
  private divineFavorSystem?: DivineFavorSystem;
  private genealogySystem?: GenealogySystem;
  private config: EconomyConfig;
  private yieldResiduals = new Map<string, number>();

  constructor(
    state: GameState,
    inventorySystem: InventorySystem,
    socialSystem: SocialSystem,
    config?: Partial<EconomyConfig>,
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
    this.config = { ...DEFAULT_ECONOMY_CONFIG, ...config };
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

  public update(_delta: number): void {}

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

    // Divine/Genealogy Bonus
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

    if (workerGroup) {
      // Simplified check: count members in same zone (assuming they are working if in zone)
      // In a real implementation, we would check their activity
      const agentsInZone = this.state.entities.filter((e) => {
        // Simple bounds check
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
