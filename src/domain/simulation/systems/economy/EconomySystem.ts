import type { GameState, Zone } from "@/shared/types/game-types";
import type {
  EconomyConfig,
  ResourceType,
  MarketConfig,
} from "@/shared/types/simulation/economy";
import { ResourceType as ResourceTypeEnum } from "../../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";
import { RoleType } from "../../../../shared/constants/RoleEnums";
import { InventorySystem } from "./InventorySystem";
import { SocialSystem } from "../social/SocialSystem";
import { RoleSystem } from "../agents/RoleSystem";

import { simulationEvents, GameEventType } from "../../core/events";
import { logger } from "../../../../infrastructure/utils/logger";

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
    iron_ore: 10,
    copper_ore: 12,
  },
};

export interface TransactionRecord {
  type: "income" | "expense";
  amount: number;
  reason: string;
  timestamp: number;
  relatedEntityId?: string;
}

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import type { EntityIndex } from "../../core/EntityIndex";
import type { AgentRegistry } from "../agents/AgentRegistry";
import type { HandlerResult, ITradeSystem } from "../agents/SystemRegistry";
import { QuestStatus } from "../../../../shared/constants/QuestEnums";

/**
 * System for managing economic activities: resource production, salaries, market pricing, and trading.
 *
 * Features:
 * - Resource yield calculations based on work duration
 * - Salary payment system for agents with roles
 * - Dynamic pricing based on resource scarcity (merged from MarketSystem)
 * - Automatic trading between agents
 * - Yield residuals for fractional resource accumulation
 *
 * @see RoleSystem for agent role assignments
 * @see InventorySystem for resource storage
 */
@injectable()
export class EconomySystem implements ITradeSystem {
  public readonly name = "trade";
  private state: GameState;
  private inventorySystem: InventorySystem;
  private socialSystem: SocialSystem;
  private roleSystem?: RoleSystem;

  private config: EconomyConfig;
  private marketConfig: MarketConfig;
  private yieldResiduals = new Map<string, number>();
  private transactionHistory = new Map<string, TransactionRecord[]>();
  private lastUpdate = Date.now();
  private readonly UPDATE_INTERVAL_MS = 10000;
  private lastSalaryPayment = 0;
  private readonly SALARY_INTERVAL_MS = 60000;
  private entityIndex?: EntityIndex;
  private agentRegistry?: AgentRegistry;

  private recentTrades = new Map<string, number>();
  private readonly TRADE_COOLDOWN_MS = 30000;

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
    this.marketConfig = DEFAULT_MARKET_CONFIG;
  }

  public getTransactionHistory(agentId: string): TransactionRecord[] {
    return this.transactionHistory.get(agentId) || [];
  }

  private recordTransaction(
    agentId: string,
    type: "income" | "expense",
    amount: number,
    reason: string,
    relatedEntityId?: string,
  ): void {
    const history = this.transactionHistory.get(agentId) || [];
    history.unshift({
      type,
      amount,
      reason,
      timestamp: Date.now(),
      relatedEntityId,
    });
    if (history.length > 10) {
      history.pop();
    }
    this.transactionHistory.set(agentId, history);
  }

  public setDependencies(deps: { roleSystem?: RoleSystem }): void {
    this.roleSystem = deps.roleSystem;
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

    this.updateMarket();
  }

  private updateMarket(): void {
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
      ResourceTypeEnum.WOOD,
      ResourceTypeEnum.STONE,
      ResourceTypeEnum.FOOD,
      ResourceTypeEnum.WATER,
      ResourceTypeEnum.METAL,
    ];
    for (const resource of resourceTypes) {
      prices[resource] = this.getResourcePrice(resource);
    }
    this.state.market.prices = prices;
  }

  public getResourcePrice(resource: ResourceTypeEnum): number {
    const scarcity = this.computeScarcityMultiplier(resource);
    return Math.max(
      1,
      Math.round(this.marketConfig.basePrices[resource] * scarcity),
    );
  }

  private computeScarcityMultiplier(resource: ResourceTypeEnum): number {
    let stock = 0;
    if (this.state.resources) {
      stock += this.state.resources.materials[resource] || 0;
    }

    const stats = this.inventorySystem.getSystemStats();
    stock += stats.stockpiled[resource];

    const { low, high } = this.marketConfig.scarcityThresholds;
    if (stock < low) return this.marketConfig.lowMultiplier;
    if (stock > high) return this.marketConfig.highMultiplier;
    return this.marketConfig.normalMultiplier;
  }

  public buyResource(
    buyerId: string,
    resource: ResourceTypeEnum,
    amount: number,
  ): boolean {
    const price = this.getResourcePrice(resource);
    const totalCost = price * amount;

    if (!this.canAfford(buyerId, totalCost)) {
      return false;
    }

    const added = this.inventorySystem.addResource(buyerId, resource, amount);
    if (!added) {
      return false;
    }

    this.removeMoney(buyerId, totalCost);

    if (this.state.resources) {
      this.state.resources.currency += totalCost;
    }

    return true;
  }

  public sellResource(
    sellerId: string,
    resource: ResourceTypeEnum,
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

    this.addMoney(sellerId, totalValue);

    if (this.state.resources) {
      this.state.resources.currency = Math.max(
        0,
        this.state.resources.currency - totalValue,
      );
    }

    return totalValue;
  }

  private autoTradeAmongAgents(): void {
    const entities: Array<{ id: string }> = [];
    if (this.agentRegistry) {
      for (const profile of this.agentRegistry.getAllProfiles()) {
        if (!profile.isDead) entities.push(profile);
      }
    } else if (this.state.entities) {
      entities.push(...this.state.entities);
    }
    if (entities.length < 2) return;

    const now = Date.now();

    for (const [key, timestamp] of this.recentTrades) {
      if (now - timestamp > this.TRADE_COOLDOWN_MS) {
        this.recentTrades.delete(key);
      }
    }

    for (let i = 0; i < entities.length; i++) {
      const seller = entities[i];
      if (!seller || !seller.id) continue;

      const sellerInv = this.inventorySystem.getAgentInventory(seller.id);
      if (!sellerInv) continue;

      for (const resource of [
        ResourceTypeEnum.WOOD,
        ResourceTypeEnum.STONE,
        ResourceTypeEnum.FOOD,
        ResourceTypeEnum.WATER,
        ResourceTypeEnum.METAL,
      ]) {
        const sellerStock = sellerInv[resource] || 0;

        if (sellerStock < 15) continue;

        for (let j = 0; j < entities.length; j++) {
          if (i === j) continue;
          const buyer = entities[j];
          if (!buyer || !buyer.id) continue;

          const tradeKey = [seller.id, buyer.id, resource].sort().join(":");
          if (this.recentTrades.has(tradeKey)) continue;

          const buyerInv = this.inventorySystem.getAgentInventory(buyer.id);

          if (!buyerInv || (buyerInv[resource] || 0) > 3) continue;

          const tradeAmount = Math.min(5, sellerStock);
          const price = this.getResourcePrice(resource);
          const cost = price * tradeAmount;

          if (!this.canAfford(buyer.id, cost)) continue;

          const removed = this.inventorySystem.removeFromAgent(
            seller.id,
            resource,
            tradeAmount,
          );
          if (removed > 0) {
            this.inventorySystem.addResource(buyer.id, resource, removed);

            this.transferMoney(buyer.id, seller.id, cost);

            this.recentTrades.set(tradeKey, now);

            logger.debug(
              `🔄 [MARKET] Auto-trade: ${seller.id} sold ${removed} ${resource} to ${buyer.id} for ${cost}`,
            );
            return;
          }
        }
      }
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

    simulationEvents.emit(GameEventType.ECONOMY_RESERVATIONS_UPDATE, {
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

      if (this.addMoney(agent.id, baseSalary, "Salario")) {
        totalSalaries += baseSalary;

        simulationEvents.emit(GameEventType.SALARY_PAID, {
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

      this.addMoney(agentId, salary, `Trabajo: ${resourceType}`);

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
  public addMoney(
    agentId: string,
    amount: number,
    reason = "Ingreso vario",
  ): boolean {
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

    this.recordTransaction(agentId, "income", amount, reason);

    simulationEvents.emit(GameEventType.MONEY_CHANGED, {
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
  public removeMoney(
    agentId: string,
    amount: number,
    reason = "Gasto vario",
  ): boolean {
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

    this.recordTransaction(agentId, "expense", amount, reason);

    simulationEvents.emit(GameEventType.MONEY_CHANGED, {
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

    if (!this.removeMoney(fromId, amount, `Transferencia a ${toId}`)) {
      return false;
    }

    if (!this.addMoney(toId, amount, `Transferencia de ${fromId}`)) {
      this.addMoney(fromId, amount, "Reembolso por fallo en transferencia");
      return false;
    }

    simulationEvents.emit(GameEventType.MONEY_TRANSFERRED, {
      fromId,
      toId,
      amount,
      timestamp: Date.now(),
    });

    return true;
  }



  /**
   * Solicita un intercambio comercial entre dos agentes.
   * @param buyerId - ID del comprador
   * @param sellerId - ID del vendedor
   * @param itemId - ID/tipo del recurso a comprar
   * @param quantity - Cantidad a comprar
   * @param price - Precio por unidad
   */
  public requestTrade(
    buyerId: string,
    sellerId: string,
    itemId: string,
    quantity: number,
    price: number,
  ): HandlerResult {
    const totalCost = price * quantity;


    if (!this.canAfford(buyerId, totalCost)) {
      return {
        status: QuestStatus.FAILED,
        system: "trade",
        message: `Buyer ${buyerId} cannot afford ${totalCost}`,
        data: { required: totalCost },
      };
    }


    if (!this.inventorySystem) {
      return {
        status: QuestStatus.FAILED,
        system: "trade",
        message: "Inventory system not available",
      };
    }

    const sellerInventory = this.inventorySystem.getAgentInventory(sellerId);
    if (!sellerInventory) {
      return {
        status: QuestStatus.FAILED,
        system: "trade",
        message: `Seller ${sellerId} has no inventory`,
      };
    }

    const resourceType = itemId as ResourceType;
    const available = sellerInventory[resourceType] ?? 0;
    if (available < quantity) {
      return {
        status: QuestStatus.FAILED,
        system: "trade",
        message: `Seller doesn't have enough ${itemId}`,
        data: { available, requested: quantity },
      };
    }



    if (!this.transferMoney(buyerId, sellerId, totalCost)) {
      return {
        status: QuestStatus.FAILED,
        system: "trade",
        message: "Money transfer failed",
      };
    }


    this.inventorySystem.removeFromAgent(sellerId, resourceType, quantity);
    this.inventorySystem.addResource(buyerId, resourceType, quantity);

    simulationEvents.emit(GameEventType.TRADE_COMPLETED, {
      buyerId,
      sellerId,
      resourceType: itemId,
      quantity,
      totalPrice: totalCost,
      timestamp: Date.now(),
    });

    return {
      status: "completed",
      system: "trade",
      message: `Trade completed: ${quantity}x ${itemId} for ${totalCost}`,
      data: {
        buyerId,
        sellerId,
        itemId,
        quantity,
        totalCost,
      },
    };
  }
}
