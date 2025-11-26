import {
  Inventory,
  Stockpile,
  ResourceType,
} from "../../types/simulation/economy";
import type { GameState } from "../../types/game-types";
import { logger } from "../../../infrastructure/utils/logger";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

/**
 * System for managing agent inventories and zone stockpiles.
 *
 * Features:
 * - Per-agent inventory with capacity limits
 * - Zone-based stockpiles for shared storage
 * - Resource transfer between agents and stockpiles
 * - Automatic deprecation of old inventories
 * - Resource type management (wood, stone, food, water)
 *
 * @see ResourceType for available resource types
 */
@injectable()
export class InventorySystem {
  private gameState?: GameState;
  private agentInventories = new Map<string, Inventory>();
  private stockpiles = new Map<string, Stockpile>();
  private stockpilesByZone = new Map<string, Set<string>>();

  private lastDeprecationCheck = 0;
  private readonly DEPRECATION_INTERVAL = 10000;
  private readonly DEFAULT_AGENT_CAPACITY = 50;
  private readonly DEFAULT_STOCKPILE_CAPACITY = 1000;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
  }

  public initializeAgentInventory(
    agentId: string,
    capacity?: number,
  ): Inventory {
    const inventory: Inventory = {
      wood: 0,
      stone: 0,
      food: 0,
      water: 0,
      rare_materials: 0,
      capacity: capacity ?? this.DEFAULT_AGENT_CAPACITY,
      lastUpdateTime: Date.now(),
    };
    this.agentInventories.set(agentId, inventory);
    return inventory;
  }

  public createStockpile(
    zoneId: string,
    type: Stockpile["type"],
    capacity?: number,
  ): Stockpile {
    const id = `stockpile_${zoneId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stockpile: Stockpile = {
      id,
      zoneId,
      inventory: {
        wood: 0,
        stone: 0,
        food: 0,
        water: 0,
        rare_materials: 0,
        capacity: capacity ?? this.DEFAULT_STOCKPILE_CAPACITY,
        lastUpdateTime: Date.now(),
      },
      capacity: capacity ?? this.DEFAULT_STOCKPILE_CAPACITY,
      type,
      lastUpdateTime: Date.now(),
    };
    this.stockpiles.set(stockpile.id, stockpile);

    if (!this.stockpilesByZone.has(zoneId)) {
      this.stockpilesByZone.set(zoneId, new Set());
    }
    this.stockpilesByZone.get(zoneId)!.add(stockpile.id);

    return stockpile;
  }

  public getAgentInventory(agentId: string): Inventory | undefined {
    return this.agentInventories.get(agentId);
  }

  public removeAgentInventory(agentId: string): void {
    this.agentInventories.delete(agentId);
  }

  public getStockpile(stockpileId: string): Stockpile | undefined {
    return this.stockpiles.get(stockpileId);
  }

  public getStockpilesInZone(zoneId: string): Stockpile[] {
    const ids = this.stockpilesByZone.get(zoneId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.stockpiles.get(id)!)
      .filter(Boolean);
  }

  public getAllStockpiles(): Stockpile[] {
    return [...this.stockpiles.values()];
  }

  public addResource(
    agentId: string,
    resource: ResourceType,
    amount: number,
  ): boolean {
    const inv = this.agentInventories.get(agentId);
    if (!inv) return false;

    const currentLoad =
      inv.wood + inv.stone + inv.food + inv.water + inv.rare_materials;
    const available = inv.capacity - currentLoad;
    const toAdd = Math.min(amount, available);

    if (toAdd <= 0) return false;

    inv[resource] += toAdd;
    return true;
  }

  public addToStockpile(
    stockpileId: string,
    resource: ResourceType,
    amount: number,
  ): boolean {
    const sp = this.stockpiles.get(stockpileId);
    if (!sp) return false;

    const currentLoad =
      sp.inventory.wood +
      sp.inventory.stone +
      sp.inventory.food +
      sp.inventory.water +
      sp.inventory.rare_materials;
    const available = sp.capacity - currentLoad;
    const toAdd = Math.min(amount, available);

    if (toAdd <= 0) return false;

    sp.inventory[resource] += toAdd;
    return true;
  }

  public consumeFromStockpile(
    stockpileId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean {
    const sp = this.stockpiles.get(stockpileId);
    if (!sp) return false;

    const entries = Object.entries(resources || {}) as [ResourceType, number][];
    for (const [resource, amount] of entries) {
      if (!amount) continue;
      if ((sp.inventory[resource] ?? 0) < amount) {
        return false;
      }
    }

    for (const [resource, amount] of entries) {
      if (!amount) continue;
      sp.inventory[resource] -= amount;
    }

    return true;
  }

  public removeFromAgent(
    agentId: string,
    resource: ResourceType,
    amount: number,
  ): number {
    const inv = this.agentInventories.get(agentId);
    if (!inv) return 0;

    const removed = Math.min(amount, inv[resource]);
    inv[resource] -= removed;
    return removed;
  }

  public consumeFromAgent(
    agentId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean {
    const inv = this.agentInventories.get(agentId);
    if (!inv) return false;

    for (const [resource, amount] of Object.entries(resources)) {
      if (!amount || amount <= 0) continue;
      if ((inv[resource as ResourceType] ?? 0) < amount) {
        return false;
      }
    }

    for (const [resource, amount] of Object.entries(resources)) {
      if (!amount || amount <= 0) continue;
      inv[resource as ResourceType] -= amount;
    }

    return true;
  }

  public transferToStockpile(
    agentId: string,
    stockpileId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): Record<ResourceType, number> {
    const transferred: Record<ResourceType, number> = {
      wood: 0,
      stone: 0,
      food: 0,
      water: 0,
      rare_materials: 0,
    };

    const entries = Object.entries(resources) as [ResourceType, number][];
    for (const [resource, amount] of entries) {
      if (!amount || amount <= 0) continue;

      const inv = this.agentInventories.get(agentId);
      if (!inv || inv[resource] <= 0) continue;

      const sp = this.stockpiles.get(stockpileId);
      if (!sp) continue;

      const currentLoad =
        sp.inventory.wood +
        sp.inventory.stone +
        sp.inventory.food +
        sp.inventory.water +
        sp.inventory.rare_materials;
      const availableSpace = sp.capacity - currentLoad;

      if (availableSpace <= 0) continue;

      const canTake = Math.min(amount, inv[resource]);
      const canStore = Math.min(canTake, availableSpace);

      if (canStore > 0) {
        this.removeFromAgent(agentId, resource, canStore);
        this.addToStockpile(stockpileId, resource, canStore);
        transferred[resource] = canStore;
      }
    }

    return transferred;
  }

  /**
   * Transfers resources between two agents atomically.
   * Validates capacity and availability before executing to prevent resource loss.
   *
   * @throws {Error} If validation fails (insufficient resources or capacity)
   */
  public transferBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): Record<ResourceType, number> {
    const fromInv = this.getAgentInventory(fromAgentId);
    const toInv = this.getAgentInventory(toAgentId);

    if (!fromInv) {
      throw new Error(`Source agent ${fromAgentId} has no inventory`);
    }
    if (!toInv) {
      throw new Error(`Target agent ${toAgentId} has no inventory`);
    }

    const transferred: Record<ResourceType, number> = {
      wood: 0,
      stone: 0,
      food: 0,
      water: 0,
      rare_materials: 0,
    };

    // Phase 1: Validate source has sufficient resources
    for (const [resource, amount] of Object.entries(resources)) {
      if (!amount || amount <= 0) continue;
      const resourceType = resource as ResourceType;

      if ((fromInv[resourceType] ?? 0) < amount) {
        throw new Error(
          `Insufficient ${resource}: agent ${fromAgentId} has ${fromInv[resourceType] ?? 0}, requested ${amount}`,
        );
      }
    }

    // Phase 2: Validate target has capacity
    const toCurrentLoad =
      toInv.wood +
      toInv.stone +
      toInv.food +
      toInv.water +
      toInv.rare_materials;
    const toAvailableCapacity = toInv.capacity - toCurrentLoad;

    const transferTotal = Object.values(resources).reduce(
      (sum, amt) => sum + (amt || 0),
      0,
    );

    if (transferTotal > toAvailableCapacity) {
      throw new Error(
        `Insufficient capacity: agent ${toAgentId} has ${toAvailableCapacity} space, transfer requires ${transferTotal}`,
      );
    }

    // Phase 3: Execute atomic transfer
    for (const [resource, amount] of Object.entries(resources)) {
      if (!amount || amount <= 0) continue;
      const resourceType = resource as ResourceType;

      fromInv[resourceType] -= amount;
      toInv[resourceType] += amount;
      transferred[resourceType] = amount;
    }

    fromInv.lastUpdateTime = Date.now();
    toInv.lastUpdateTime = Date.now();

    logger.debug(
      `💱 [Inventory] Transfer: ${fromAgentId} → ${toAgentId} | ${JSON.stringify(transferred)}`,
    );

    return transferred;
  }

  public update(): void {
    const now = Date.now();
    if (now - this.lastDeprecationCheck < this.DEPRECATION_INTERVAL) return;
    this.lastDeprecationCheck = now;

    const statsDebug = this.getSystemStats();
    logger.debug(
      `[InventorySystem] update() - Agents: ${statsDebug.totalAgentInventories}, inAgents: food=${statsDebug.inAgents.food}, water=${statsDebug.inAgents.water}, wood=${statsDebug.inAgents.wood}, stone=${statsDebug.inAgents.stone}`,
    );

    const FOOD_DECAY_RATE = 0.02;
    const WATER_DECAY_RATE = 0.01;

    for (const sp of this.stockpiles.values()) {
      const foodLoss = Math.floor(sp.inventory.food * FOOD_DECAY_RATE);
      const waterLoss = Math.floor(sp.inventory.water * WATER_DECAY_RATE);

      if (foodLoss > 0)
        sp.inventory.food = Math.max(0, sp.inventory.food - foodLoss);
      if (waterLoss > 0)
        sp.inventory.water = Math.max(0, sp.inventory.water - waterLoss);
    }

    for (const inv of this.agentInventories.values()) {
      const foodLoss = Math.floor(inv.food * FOOD_DECAY_RATE);
      const waterLoss = Math.floor(inv.water * WATER_DECAY_RATE);

      if (foodLoss > 0) inv.food = Math.max(0, inv.food - foodLoss);
      if (waterLoss > 0) inv.water = Math.max(0, inv.water - waterLoss);
    }

    if (this.gameState) {
      if (!this.gameState.inventory) {
        this.gameState.inventory = {
          global: {
            wood: 0,
            stone: 0,
            food: 0,
            water: 0,
            rare_materials: 0,
            capacity: 0,
            lastUpdateTime: now,
          },
          stockpiles: {},
          agents: {},
        };
      }

      const stockpilesObj: Record<string, Inventory> = {};
      for (const stockpile of this.stockpiles.values()) {
        stockpilesObj[stockpile.id] = stockpile.inventory;
      }
      this.gameState.inventory!.stockpiles = stockpilesObj;

      const agentsObj: Record<string, Inventory> = {};
      for (const [agentId, inv] of this.agentInventories) {
        agentsObj[agentId] = inv;
      }
      this.gameState.inventory!.agents = agentsObj;

      const stats = this.getSystemStats();
      this.gameState.inventory!.global = {
        wood: stats.stockpiled.wood + stats.inAgents.wood,
        stone: stats.stockpiled.stone + stats.inAgents.stone,
        food: stats.stockpiled.food + stats.inAgents.food,
        water: stats.stockpiled.water + stats.inAgents.water,
        rare_materials:
          stats.stockpiled.rare_materials + stats.inAgents.rare_materials,
        capacity: 0,
        lastUpdateTime: now,
      };
    }
  }

  public getSystemStats(): {
    totalStockpiles: number;
    totalAgentInventories: number;
    stockpiled: {
      wood: number;
      stone: number;
      food: number;
      water: number;
      rare_materials: number;
    };
    inAgents: {
      wood: number;
      stone: number;
      food: number;
      water: number;
      rare_materials: number;
    };
  } {
    const totalStockpiled = {
      wood: 0,
      stone: 0,
      food: 0,
      water: 0,
      rare_materials: 0,
    };
    for (const sp of this.stockpiles.values()) {
      totalStockpiled.wood += sp.inventory.wood;
      totalStockpiled.stone += sp.inventory.stone;
      totalStockpiled.food += sp.inventory.food;
      totalStockpiled.water += sp.inventory.water;
      totalStockpiled.rare_materials += sp.inventory.rare_materials;
    }

    const totalInAgents = {
      wood: 0,
      stone: 0,
      food: 0,
      water: 0,
      rare_materials: 0,
    };
    for (const inv of this.agentInventories.values()) {
      totalInAgents.wood += inv.wood;
      totalInAgents.stone += inv.stone;
      totalInAgents.food += inv.food;
      totalInAgents.water += inv.water;
      totalInAgents.rare_materials += inv.rare_materials;
    }

    return {
      totalStockpiles: this.stockpiles.size,
      totalAgentInventories: this.agentInventories.size,
      stockpiled: totalStockpiled,
      inAgents: totalInAgents,
    };
  }
}
