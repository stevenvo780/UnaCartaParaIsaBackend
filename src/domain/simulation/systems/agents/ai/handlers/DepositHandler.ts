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
import { QuestStatus } from '../../../../../../shared/constants/QuestEnums';

/**
 * @deprecated Use SystemRegistry.inventory instead
 */
export interface DepositHandlerDeps {
  findNearestStorage?: (
    agentId: string,
  ) => { id: string; position: { x: number; y: number } } | null;
  depositToStorage?: (
    agentId: string,
    storageId: string,
  ) => { deposited: boolean; items: Record<string, number> };
  getInventoryItems?: (agentId: string) => Record<string, number>;
}

/**
 * Maneja el depósito delegando al InventorySystem.
 */
export function handleDeposit(
  ctx: HandlerContext,
  _deps?: DepositHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.DEPOSIT) {
    return errorResult("Wrong task type");
  }

  if (!systems.inventory) {
    return errorResult("InventorySystem not available");
  }

  const storageId = task.target?.entityId;
  const itemId = task.params?.itemId as string | undefined;

  if (!storageId) {
    return errorResult("No storage target specified");
  }

  const result = systems.inventory.requestDeposit(
    agentId,
    storageId,
    itemId ?? "all",
  );

  switch (result.status) {
    case "completed":
      return successResult({
        storageId,
        deposited: itemId ?? "all",
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case QuestStatus.FAILED:
      return errorResult(result.message ?? "Deposit failed");

    case "in_progress":
      return inProgressResult("inventory", result.message ?? "Depositing");

    case "delegated":
      return inProgressResult(
        result.system,
        result.message ?? "Moving to storage",
      );

    default:
      return inProgressResult("inventory", "Processing deposit");
  }
}
