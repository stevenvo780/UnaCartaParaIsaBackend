import {
  Inventory,
  Stockpile,
  ResourceType,
} from "../../types/simulation/economy";
import type { GameState } from "../../types/game-types";

export class InventorySystem {
  private gameState?: GameState;
  private agentInventories = new Map<string, Inventory>();
  private stockpiles = new Map<string, Stockpile>();
  private stockpilesByZone = new Map<string, Set<string>>();

  private lastDeprecationCheck = 0;
  private readonly DEPRECATION_INTERVAL = 10000;
  private readonly DEFAULT_AGENT_CAPACITY = 50;
  private readonly DEFAULT_STOCKPILE_CAPACITY = 1000;

  constructor(gameState?: GameState) {
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
    return Array.from(this.stockpiles.values());
  }

  public addResource(
    agentId: string,
    resource: ResourceType,
    amount: number,
  ): boolean {
    const inv = this.agentInventories.get(agentId);
    if (!inv) return false;

    const currentLoad = inv.wood + inv.stone + inv.food + inv.water;
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
      sp.inventory.water;
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

  public update(): void {
    const now = Date.now();
    if (now - this.lastDeprecationCheck < this.DEPRECATION_INTERVAL) return;
    this.lastDeprecationCheck = now;

    const FOOD_DECAY_RATE = 0.02;
    const WATER_DECAY_RATE = 0.01;

    // Deprecate stockpiles
    for (const sp of Array.from(this.stockpiles.values())) {
      const foodLoss = Math.floor(sp.inventory.food * FOOD_DECAY_RATE);
      const waterLoss = Math.floor(sp.inventory.water * WATER_DECAY_RATE);

      if (foodLoss > 0)
        sp.inventory.food = Math.max(0, sp.inventory.food - foodLoss);
      if (waterLoss > 0)
        sp.inventory.water = Math.max(0, sp.inventory.water - waterLoss);
    }

    // Deprecate agent inventories
    for (const inv of Array.from(this.agentInventories.values())) {
      const foodLoss = Math.floor(inv.food * FOOD_DECAY_RATE);
      const waterLoss = Math.floor(inv.water * WATER_DECAY_RATE);

      if (foodLoss > 0) inv.food = Math.max(0, inv.food - foodLoss);
      if (waterLoss > 0) inv.water = Math.max(0, inv.water - waterLoss);
    }

    // Escribir estado en GameState para sincronización con frontend
    if (this.gameState) {
      if (!this.gameState.inventory) {
        this.gameState.inventory = {
          global: {
            wood: 0,
            stone: 0,
            food: 0,
            water: 0,
            capacity: 0,
            lastUpdateTime: now,
          },
          stockpiles: new Map(),
        };
      }

      // Convertir stockpiles Map a Map serializable
      const stockpilesMap = new Map<string, Inventory>();
      this.stockpiles.forEach((stockpile) => {
        stockpilesMap.set(stockpile.id, stockpile.inventory);
      });
      this.gameState.inventory.stockpiles = stockpilesMap;

      // Calcular inventario global (suma de todos los agentes y stockpiles)
      const stats = this.getSystemStats();
      this.gameState.inventory.global = {
        wood: stats.stockpiled.wood + stats.inAgents.wood,
        stone: stats.stockpiled.stone + stats.inAgents.stone,
        food: stats.stockpiled.food + stats.inAgents.food,
        water: stats.stockpiled.water + stats.inAgents.water,
        capacity: 0, // No hay capacidad global
        lastUpdateTime: now,
      };
    }
  }

  public getSystemStats() {
    const totalStockpiled = { wood: 0, stone: 0, food: 0, water: 0 };
    for (const sp of Array.from(this.stockpiles.values())) {
      totalStockpiled.wood += sp.inventory.wood;
      totalStockpiled.stone += sp.inventory.stone;
      totalStockpiled.food += sp.inventory.food;
      totalStockpiled.water += sp.inventory.water;
    }

    const totalInAgents = { wood: 0, stone: 0, food: 0, water: 0 };
    for (const inv of Array.from(this.agentInventories.values())) {
      totalInAgents.wood += inv.wood;
      totalInAgents.stone += inv.stone;
      totalInAgents.food += inv.food;
      totalInAgents.water += inv.water;
    }

    return {
      totalStockpiles: this.stockpiles.size,
      totalAgentInventories: this.agentInventories.size,
      stockpiled: totalStockpiled,
      inAgents: totalInAgents,
    };
  }
}
