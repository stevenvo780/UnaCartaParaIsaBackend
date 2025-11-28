import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { StockpileType } from "../../../shared/constants/ZoneEnums";
import {
  MarketOrderType,
  MarketOrderStatus,
} from "../../../shared/constants/EconomyEnums";

/**
 * Re-export enums for backward compatibility.
 */
export { ResourceType };

export interface Inventory {
  wood: number;
  stone: number;
  food: number;
  water: number;
  rare_materials: number;
  metal: number;
  iron_ore: number;
  copper_ore: number;
  capacity: number;
  lastUpdateTime?: number;
}

export interface Stockpile {
  id: string;
  zoneId: string;
  inventory: Inventory;
  capacity: number;
  type: StockpileType;
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
    metal: number;
  };
  salaryRates: {
    wood: number;
    stone: number;
    food: number;
    water: number;
    rare_materials: number;
    metal: number;
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
  type: MarketOrderType;
  resource: ResourceType;
  amount: number;
  priceLimit?: number;
  timestamp: number;
  status: MarketOrderStatus;
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
  metal?: number;
}
