/**
 * @fileoverview Handler de Depósito - Delegación a InventorySystem
 *
 * Handler simplificado que delega el depósito al InventorySystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/DepositHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { logger } from "@/infrastructure/utils/logger";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/**
 * Maneja el depósito delegando al InventorySystem.
 */
export function handleDeposit(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  logger.debug(`📦 [DepositHandler] ${agentId}: entering handler`);

  if (task.type !== TaskType.DEPOSIT) {
    logger.debug(
      `📦 [DepositHandler] ${agentId}: wrong task type ${task.type}`,
    );
    return errorResult("Wrong task type");
  }

  if (!systems.inventory) {
    logger.debug(
      `📦 [DepositHandler] ${agentId}: InventorySystem not available`,
    );
    return errorResult("InventorySystem not available");
  }

  const storageId = task.target?.entityId;
  const itemId = task.params?.itemId as string | undefined;

  logger.debug(
    `📦 [DepositHandler] ${agentId}: storageId=${storageId}, itemId=${itemId}`,
  );

  if (!storageId) {
    logger.debug(`📦 [DepositHandler] ${agentId}: No storage target specified`);
    return errorResult("No storage target specified");
  }

  const result = systems.inventory.requestDeposit(
    agentId,
    storageId,
    itemId ?? "all",
  );

  logger.debug(
    `📦 [DepositHandler] ${agentId}: requestDeposit result=${result.status}, msg=${result.message}`,
  );

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      return successResult({
        storageId,
        deposited: itemId ?? "all",
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Deposit failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("inventory", result.message ?? "Depositing");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to storage",
      );

    default:
      return inProgressResult("inventory", "Processing deposit");
  }
}
