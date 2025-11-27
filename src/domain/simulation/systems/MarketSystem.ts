import type { GameState } from "../../types/game-types";
import type { MarketConfig } from "../../types/simulation/economy";
import { InventorySystem } from "./InventorySystem";
import { EconomySystem } from "./EconomySystem";
import { logger } from "../../../infrastructure/utils/logger";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

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
    rare_materials: 25,
    metal: 15,
  },
};

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

/**
 * System for managing market dynamics and resource trading.
 *
 * Features:
 * - Dynamic pricing based on resource scarcity
 * - Automatic trading between agents
 * - Market orders and transactions
 * - Price multipliers for low/high scarcity scenarios
 *
 * @see InventorySystem for resource management
 * @see EconomySystem for money management
 */
@injectable()
export class MarketSystem {
  private state: GameState;
  private inventorySystem: InventorySystem;
  private economySystem: EconomySystem;
  private config: MarketConfig;

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.InventorySystem) inventorySystem: InventorySystem,
    @inject(TYPES.EconomySystem) economySystem: EconomySystem,
  ) {
    this.state = state;
    this.inventorySystem = inventorySystem;
    this.economySystem = economySystem;
    this.config = DEFAULT_MARKET_CONFIG;
  }

  public update(_delta: number): void {
    this.autoTradeAmongAgents();

    if (!this.state.market) {
      this.state.market = {
        orders: [],
        transactions: [],
        prices: {},
      };
    }

    const prices: Record<string, number> = {};
    const resourceTypes = [
      ResourceType.WOOD,
      ResourceType.STONE,
      ResourceType.FOOD,
      ResourceType.WATER,
      ResourceType.METAL,
    ];
    for (const resource of resourceTypes) {
      prices[resource] = this.getResourcePrice(resource);
    }
    this.state.market.prices = prices;
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

  public buyResource(
    buyerId: string,
    resource: ResourceType,
    amount: number,
  ): boolean {
    const price = this.getResourcePrice(resource);
    const totalCost = price * amount;

    if (!this.economySystem.canAfford(buyerId, totalCost)) {
      return false;
    }

    const added = this.inventorySystem.addResource(buyerId, resource, amount);
    if (!added) {
      return false;
    }

    this.economySystem.removeMoney(buyerId, totalCost);

    if (this.state.resources) {
      this.state.resources.currency += totalCost;
    }

    return true;
  }

  public sellResource(
    sellerId: string,
    resource: ResourceType,
    amount: number,
  ): number {
    const removed = this.inventorySystem.removeFromAgent(
      sellerId,
      resource,
      amount,
    );
    if (removed <= 0) return 0;

    const price = this.getResourcePrice(resource);
    const totalValue = price * removed;

    this.economySystem.addMoney(sellerId, totalValue);

    if (this.state.resources) {
      this.state.resources.currency = Math.max(
        0,
        this.state.resources.currency - totalValue,
      );
    }

    return totalValue;
  }

  private autoTradeAmongAgents(): void {
    const entities = this.state.entities || [];
    if (entities.length < 2) return;

    for (let i = 0; i < entities.length; i++) {
      const seller = entities[i];
      if (!seller || !seller.id) continue;

      const sellerInv = this.inventorySystem.getAgentInventory(seller.id);
      if (!sellerInv) continue;

      for (const resource of [
        ResourceType.WOOD,
        ResourceType.STONE,
        ResourceType.FOOD,
        ResourceType.WATER,
        ResourceType.METAL,
      ]) {
        const sellerStock = sellerInv[resource] || 0;
        if (sellerStock < 10) continue;

        for (let j = 0; j < entities.length; j++) {
          if (i === j) continue;
          const buyer = entities[j];
          if (!buyer || !buyer.id) continue;

          const buyerInv = this.inventorySystem.getAgentInventory(buyer.id);
          if (!buyerInv || (buyerInv[resource] || 0) > 5) continue;

          const tradeAmount = Math.min(5, sellerStock);
          const price = this.getResourcePrice(resource);
          const cost = price * tradeAmount;

          if (!this.economySystem.canAfford(buyer.id, cost)) continue;

          const removed = this.inventorySystem.removeFromAgent(
            seller.id,
            resource,
            tradeAmount,
          );
          if (removed > 0) {
            this.inventorySystem.addResource(buyer.id, resource, removed);

            this.economySystem.transferMoney(buyer.id, seller.id, cost);

            logger.debug(
              `🔄 [MARKET] Auto-trade: ${seller.id} sold ${removed} ${resource} to ${buyer.id} for ${cost}`,
            );
            return;
          }
        }
      }
    }
  }
}
