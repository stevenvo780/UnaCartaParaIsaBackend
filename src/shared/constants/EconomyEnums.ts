/**
 * Economy type enumerations for the simulation system.
 *
 * Defines all economy-related types including market order types and statuses.
 *
 * @module shared/constants/EconomyEnums
 */

import { ResourceType } from "./ResourceEnums";

/**
 * Enumeration of market order types.
 */
export enum MarketOrderType {
  BUY = "buy",
  SELL = "sell",
}

/**
 * Enumeration of market order statuses.
 */
export enum MarketOrderStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Type representing all possible market order type values.
 */
export type MarketOrderTypeValue = `${MarketOrderType}`;

/**
 * Type representing all possible market order status values.
 */
export type MarketOrderStatusValue = `${MarketOrderStatus}`;

/**
 * Array of all market order types for iteration.
 */
export const ALL_MARKET_ORDER_TYPES: readonly MarketOrderType[] = Object.values(
  MarketOrderType,
) as MarketOrderType[];

/**
 * Array of all market order statuses for iteration.
 */
export const ALL_MARKET_ORDER_STATUSES: readonly MarketOrderStatus[] =
  Object.values(MarketOrderStatus) as MarketOrderStatus[];

/**
 * Type guard to check if a string is a valid MarketOrderType.
 */
export function isMarketOrderType(value: string): value is MarketOrderType {
  return Object.values(MarketOrderType).includes(value as MarketOrderType);
}

/**
 * Type guard to check if a string is a valid MarketOrderStatus.
 */
export function isMarketOrderStatus(value: string): value is MarketOrderStatus {
  return Object.values(MarketOrderStatus).includes(value as MarketOrderStatus);
}

/**
 * Default base prices for resources in the market.
 */
export const DEFAULT_BASE_PRICES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.WOOD]: 1,
  [ResourceType.STONE]: 1,
  [ResourceType.FOOD]: 2,
  [ResourceType.WATER]: 1,
  [ResourceType.RARE_MATERIALS]: 10,
} as const;

/**
 * Default salary rates for resources.
 */
export const DEFAULT_SALARY_RATES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.WOOD]: 0.5,
  [ResourceType.STONE]: 0.5,
  [ResourceType.FOOD]: 1,
  [ResourceType.WATER]: 0.5,
  [ResourceType.RARE_MATERIALS]: 5,
} as const;
