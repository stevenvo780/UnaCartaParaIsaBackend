export type ResourceType = "wood" | "stone" | "food" | "water" | "rare_materials";

export interface Inventory {
  wood: number;
  stone: number;
  food: number;
  water: number;
  rare_materials: number;
  capacity: number;
  lastUpdateTime?: number;}

export interface Stockpile {
  id: string;
  zoneId: string;
  inventory: Inventory;
  capacity: number;
  type: "general" | "food" | "materials";
  lastUpdateTime?: number;
}

export interface EconomyConfig {
  workDurationMs: number;
  baseYield: {
    wood: number;
    stone: number;
    food: number;
    water: number;
    rare_materials: number;
  };
  salaryRates: {
    wood: number;
    stone: number;
    food: number;
    water: number;
    rare_materials: number;
  };
}

export interface MarketConfig {
  scarcityThresholds: {
    low: number;
    high: number;
  };
  lowMultiplier: number;
  highMultiplier: number;
  normalMultiplier: number;
  basePrices: Record<ResourceType, number>;
}

export interface Transaction {
  id: string;
  buyerId: string;
  sellerId: string;
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: number;
}

export interface MarketOrder {
  id: string;
  agentId: string;
  type: "buy" | "sell";
  resource: ResourceType;
  amount: number;
  priceLimit?: number;
  timestamp: number;
  status: "active" | "completed" | "cancelled";
}

export interface InventoryItem {
  type: ResourceType;
  amount: number;
  quality?: number;
}

export interface StorageContainer {
  id: string;
  capacity: number;
  items: InventoryItem[];
}

export interface ResourceCost {
  wood: number;
  stone: number;
}
