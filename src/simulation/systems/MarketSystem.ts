import type { GameState } from "../../types/game-types.js";
import type { MarketConfig, MarketOrder, ResourceType } from "../types/economy.js";
import { InventorySystem } from "./InventorySystem.js";
import { LifeCycleSystem } from "./LifeCycleSystem.js";

const DEFAULT_MARKET_CONFIG: MarketConfig = {
  scarcityThresholds: { low: 20, high: 100 },
  lowMultiplier: 1.5,
  highMultiplier: 0.9,
  normalMultiplier: 1.0,
  basePrices: {
    wood: 4,
    stone: 6,
    food: 8,
    water: 2,
  },
};

export class MarketSystem {
  private state: GameState;
  private inventorySystem: InventorySystem;
  private lifeCycleSystem: LifeCycleSystem;
  private config: MarketConfig;

  constructor(
    state: GameState,
    inventorySystem: InventorySystem,
    lifeCycleSystem: LifeCycleSystem,
    config?: Partial<MarketConfig>
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.lifeCycleSystem = lifeCycleSystem;
    this.config = { ...DEFAULT_MARKET_CONFIG, ...config };
  }

  public update(_delta: number): void {
    this.autoTradeAmongAgents();
  }

  public getResourcePrice(resource: ResourceType): number {
    const scarcity = this.computeScarcityMultiplier(resource);
    return Math.max(1, Math.round(this.config.basePrices[resource] * scarcity));
  }

  private computeScarcityMultiplier(resource: ResourceType): number {
    let stock = 0;
    if (this.state.resources) {
      stock += this.state.resources.materials[resource] || 0;
    }

    const stats = this.inventorySystem.getSystemStats();
    stock += stats.stockpiled[resource];

    const { low, high } = this.config.scarcityThresholds;
    if (stock < low) return this.config.lowMultiplier;
    if (stock > high) return this.config.highMultiplier;
    return this.config.normalMultiplier;
  }

  public buyResource(buyerId: string, resource: ResourceType, amount: number): boolean {
    const price = this.getResourcePrice(resource);
    const totalCost = price * amount;

    const buyer = this.state.entities.find((e) => e.id === buyerId);
    if (!buyer || !buyer.stats) return false;
    const buyerMoney = typeof buyer.stats.money === 'number' ? buyer.stats.money : 0;
    if (buyerMoney < totalCost) return false;

    buyer.stats.money = buyerMoney - totalCost;

    const added = this.inventorySystem.addResource(buyerId, resource, amount);
    if (!added) {
      buyer.stats.money = (typeof buyer.stats.money === 'number' ? buyer.stats.money : 0) + totalCost;
      return false;
    }

    if (this.state.resources) {
      this.state.resources.currency += totalCost;
    }

    return true;
  }

  public sellResource(sellerId: string, resource: ResourceType, amount: number): number {
    const removed = this.inventorySystem.removeFromAgent(sellerId, resource, amount);
    if (removed <= 0) return 0;

    const price = this.getResourcePrice(resource);
    const totalValue = price * removed;

    const seller = this.state.entities.find((e) => e.id === sellerId);
    if (seller && seller.stats) {
      seller.stats.money = (typeof seller.stats.money === 'number' ? seller.stats.money : 0) + totalValue;
    }

    // Deduct from global currency?
    if (this.state.resources) {
      this.state.resources.currency = Math.max(0, this.state.resources.currency - totalValue);
    }

    return totalValue;
  }

  private autoTradeAmongAgents(): void {
    // Simplified auto-trade logic
    // In a real implementation, agents would check needs and trade with each other
    // For now, stubbed
  }
}
