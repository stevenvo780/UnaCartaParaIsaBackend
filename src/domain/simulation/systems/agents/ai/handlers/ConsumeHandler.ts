/**
 * @fileoverview Handler de Consumo - Delegación a NeedsSystem
 *
 * Handler simplificado que delega el consumo al NeedsSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/ConsumeHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { moveToPosition, isAtTarget } from "./MoveHandler";
import { QuestStatus } from "../../../../../../shared/constants/QuestEnums";
import { logger } from "@/infrastructure/utils/logger";

/**
 * @deprecated Use SystemRegistry.needs instead
 */
export interface ConsumeHandlerDeps {
  consumeResource?: (
    agentId: string,
    resourceType: string,
    amount: number,
  ) => boolean;
  satisfyNeed?: (agentId: string, needType: string, amount: number) => boolean;
  hasResource?: (
    agentId: string,
    resourceType: string,
    amount: number,
  ) => boolean;
}

/**
 * Maneja el consumo delegando al NeedsSystem.
 */
export function handleConsume(
  ctx: HandlerContext,
  _deps?: ConsumeHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  logger.debug(`[ConsumeHandler] ${agentId}: type=${task.type}, target=${JSON.stringify(task.target)}, pos=(${position?.x?.toFixed(0)},${position?.y?.toFixed(0)})`);

  if (task.type !== TaskType.SATISFY_NEED) {
    return errorResult("Wrong task type");
  }

  if (!systems.needs) {
    return errorResult("NeedsSystem not available");
  }

  const needType = task.params?.needType as string | undefined;
  const itemId = task.params?.itemId as string | undefined;

  if (!needType) {
    return errorResult("No need type specified");
  }

  if (itemId) {
    const result = systems.needs.requestConsume(agentId, itemId);

    if (result.status === "completed") {
      return successResult({
        consumed: itemId,
        satisfied: needType,
      });
    }

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "Consume failed");
    }

    return inProgressResult("needs", "Consuming item");
  }

  if (task.target?.position) {
    if (!isAtTarget(position, task.target.position)) {
      return moveToPosition(ctx, task.target.position);
    }

    const result = systems.needs.requestConsume(agentId, needType);

    if (result.status === "completed") {
      return successResult({ satisfied: needType });
    }

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "No consumable resource available");
    }

    return inProgressResult("needs", "Consuming at resource location");
  }

  const result = systems.needs.requestConsume(agentId, needType);

  if (result.status === "completed") {
    return successResult({ satisfied: needType });
  }

  // If consume failed (no resources), mark task as failed so it gets removed
  // This prevents infinite "eating" loops when there's nothing to eat
  if (result.status === QuestStatus.FAILED) {
    logger.debug(`[ConsumeHandler] ${agentId}: consume failed - ${result.message}`);
    return errorResult(result.message ?? "No consumable available");
  }

  // Only return in_progress if the system explicitly says it's delegated/in_progress
  if (result.status === "in_progress" || result.status === "delegated") {
    return inProgressResult(result.system ?? "needs", result.message ?? "Looking for consumable");
  }

  // Default: fail the task if status is unknown
  return errorResult("Consume operation returned unknown status");
}
