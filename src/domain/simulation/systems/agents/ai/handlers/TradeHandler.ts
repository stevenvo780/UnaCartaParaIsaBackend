/**
 * @fileoverview Handler de Trading - Delegación a TradeSystem
 *
 * Handler simplificado que delega el comercio al TradeSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/TradeHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";

export interface TradeOffer {
  give: Record<string, number>;
  receive: Record<string, number>;
}

/**
 * @deprecated Use SystemRegistry.trade instead
 */
export interface TradeHandlerDeps {
  findNearestMarket?: (
    agentId: string,
  ) => { id: string; position: { x: number; y: number } } | null;
  getEntityPosition?: (entityId: string) => { x: number; y: number } | null;
  executeTrade?: (
    agentId: string,
    targetId: string,
    offer: TradeOffer,
  ) => { success: boolean; completed: TradeOffer };
  canTrade?: (agentId: string, targetId: string) => boolean;
}

/**
 * Maneja el comercio delegando al TradeSystem.
 */
export function handleTrade(
  ctx: HandlerContext,
  _deps?: TradeHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.TRADE) {
    return errorResult("Wrong task type");
  }

  if (!systems.trade) {
    return errorResult("TradeSystem not available");
  }

  const sellerId = task.target?.entityId;
  const itemId = task.params?.itemId as string | undefined;
  const quantity = (task.params?.quantity as number) ?? 1;
  const price = (task.params?.price as number) ?? 0;

  if (!sellerId) {
    return errorResult("No trade target specified");
  }

  if (!itemId) {
    return errorResult("No item specified for trade");
  }

  const result = systems.trade.requestTrade(
    agentId,
    sellerId,
    itemId,
    quantity,
    price,
  );

  switch (result.status) {
    case "completed":
      return successResult({
        sellerId,
        itemId,
        quantity,
        price,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case "failed":
      return errorResult(result.message ?? "Trade failed");

    case "in_progress":
      return inProgressResult("trade", result.message ?? "Trading");

    case "delegated":
      return inProgressResult(
        result.system,
        result.message ?? "Moving to trader",
      );

    default:
      return inProgressResult("trade", "Processing trade");
  }
}
