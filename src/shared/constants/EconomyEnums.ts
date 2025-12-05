/**
 * Economy type enumerations for the simulation system.
 *
 * Defines all economy-related types including market order types and statuses.
 *
 * @module shared/constants/EconomyEnums
 */

// Resource enums no longer needed tras remover configuraciones.

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
 * Enumeration of trade offer statuses.
 * Defines all possible statuses for trade offers in the trading system.
 */
export enum TradeOfferStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

// Alias/guards/configs sin uso eliminados para mantener el módulo ligero.
