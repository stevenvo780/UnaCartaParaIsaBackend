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
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

export interface TradeOffer {
  give: Record<string, number>;
  receive: Record<string, number>;
}

/**
 * Maneja el comercio delegando al TradeSystem.
 */
export function handleTrade(
  ctx: HandlerContext,
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
    case HandlerResultStatus.COMPLETED:
      return successResult({
        sellerId,
        itemId,
        quantity,
        price,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Trade failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("trade", result.message ?? "Trading");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to trader",
      );

    default:
      return inProgressResult("trade", "Processing trade");
  }
}
