import type { GameState, Zone } from '../../types/game-types.js';
import type { EconomyConfig, ResourceType } from '../../types/simulation/economy';
import { InventorySystem } from './InventorySystem.js';
import { SocialSystem } from './SocialSystem.js';
import { LifeCycleSystem } from './LifeCycleSystem.js';

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
  private config: EconomyConfig;
  private yieldResiduals = new Map<string, number>();

  constructor(
    state: GameState,
    inventorySystem: InventorySystem,
    _socialSystem: SocialSystem,
    _lifeCycleSystem: LifeCycleSystem,
    config?: Partial<EconomyConfig>
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.config = { ...DEFAULT_ECONOMY_CONFIG, ...config };
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
    const totalYield = baseYield * teamBonus;

    const key = `${agentId}:${resourceType}`;
    const residual = this.yieldResiduals.get(key) || 0;
    const amount = Math.floor(totalYield + residual);
    const newResidual = (totalYield + residual) - amount;
    this.yieldResiduals.set(key, newResidual);

    if (amount > 0) {
      const added = this.inventorySystem.addResource(agentId, resourceType, amount);
      if (!added) {
        this.addToGlobalResources(resourceType, amount);
      }
      const salary = Math.round(this.config.salaryRates[resourceType] * teamBonus);
      if (agent.stats) { // Assuming agent has stats in entity
        const currentMoney = typeof agent.stats.money === 'number' ? agent.stats.money : 0;
        agent.stats.money = currentMoney + salary;
      }
    }
  }

  private computeTeamBonus(_agentId: string, _zone: Zone): number {
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
