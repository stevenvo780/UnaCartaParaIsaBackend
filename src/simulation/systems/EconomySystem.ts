import { GameState } from "../../types/game-types";
import { EconomyConfig, ResourceType } from "../types/economy";
import { InventorySystem } from "./InventorySystem";
import { SocialSystem } from "./SocialSystem";
import { LifeCycleSystem } from "./LifeCycleSystem";
import { SpatialGrid } from "../../utils/SpatialGrid";

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
  private lifeCycleSystem: LifeCycleSystem;
  private config: EconomyConfig;
  private spatialGrid: SpatialGrid<string>;
  private yieldResiduals = new Map<string, number>();

  constructor(
    state: GameState,
    inventorySystem: InventorySystem,
    socialSystem: SocialSystem,
    lifeCycleSystem: LifeCycleSystem,
    config?: Partial<EconomyConfig>
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.socialSystem = socialSystem;
    this.lifeCycleSystem = lifeCycleSystem;
    this.config = { ...DEFAULT_ECONOMY_CONFIG, ...config };
    this.spatialGrid = new SpatialGrid(
      state.worldSize?.width ?? 2000,
      state.worldSize?.height ?? 2000,
      150
    );
  }

  public update(_delta: number): void {
    // Economy update logic (e.g. periodic salary payments, market fluctuations if integrated)
    // For now, mostly event-driven by actions
  }

  public handleWorkAction(agentId: string, zoneId: string): void {
    const zone = this.state.zones.find((z: any) => z.id === zoneId);
    if (!zone) return;

    const agent = this.state.entities.find((e: any) => e.id === agentId);
    if (!agent) return;

    // Calculate yield
    let resourceType: ResourceType | null = null;
    let baseYield = 0;

    switch (zone.type) {
      case "work":
        const res = zone.properties?.resource;
        if (res === "wood") {
          resourceType = "wood";
          baseYield = this.config.baseYield.wood;
        } else if (res === "stone") {
          resourceType = "stone";
          baseYield = this.config.baseYield.stone;
        }
        break;
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

    // Team bonus
    const teamBonus = this.computeTeamBonus(agentId, zone);
    const totalYield = baseYield * teamBonus;

    // Handle residuals
    const key = `${agentId}:${resourceType}`;
    const residual = this.yieldResiduals.get(key) || 0;
    const amount = Math.floor(totalYield + residual);
    const newResidual = (totalYield + residual) - amount;
    this.yieldResiduals.set(key, newResidual);

    if (amount > 0) {
      // Add to inventory
      const added = this.inventorySystem.addResource(agentId, resourceType, amount);
      if (!added) {
        // Add to global resources if inventory full
        this.addToGlobalResources(resourceType, amount);
      }

      // Pay salary
      const salary = Math.round(this.config.salaryRates[resourceType] * teamBonus);
      if (agent.stats) { // Assuming agent has stats in entity
        agent.stats.money = (agent.stats.money || 0) + salary;
      }
    }
  }

  private computeTeamBonus(agentId: string, zone: any): number {
    // Simplified team bonus logic
    // In a real implementation, we'd use spatialGrid to find neighbors
    // For now, let's assume 1.0 if no neighbors
    return 1.0;
  }

  private addToGlobalResources(resource: ResourceType, amount: number): void {
    if (!this.state.resources) return;
    this.state.resources.materials[resource] += amount;
  }
}
