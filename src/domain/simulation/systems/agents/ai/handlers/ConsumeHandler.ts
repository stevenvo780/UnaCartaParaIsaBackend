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
import { logger } from "@/infrastructure/utils/logger";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/**
 * Maneja el consumo delegando al NeedsSystem.
 */
export function handleConsume(
  ctx: HandlerContext,
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  const needType = task.params?.needType as string | undefined;
  const itemId = task.params?.itemId as string | undefined;

  if (task.type !== TaskType.SATISFY_NEED) {
    return errorResult("Wrong task type");
  }

  if (!systems.needs) {
    return errorResult("NeedsSystem not available");
  }

  if (!needType) {
    return errorResult("No need type specified");
  }

  if (itemId) {
    const result = systems.needs.requestConsume(agentId, itemId);

    if (result.status === HandlerResultStatus.COMPLETED) {
      return successResult({
        consumed: itemId,
        satisfied: needType,
      });
    }

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "Consume failed");
    }

    return inProgressResult("needs", "Consuming item");
  }

  if (task.target?.position) {
    if (!isAtTarget(position, task.target.position)) {
      const moveResult = moveToPosition(ctx, task.target.position);
      logger.debug(
        `[ConsumeHandler] ${agentId}: moveToPosition result=${JSON.stringify({ success: moveResult.success, completed: moveResult.completed, msg: moveResult.message })}`,
      );
      return moveResult;
    }

    logger.debug(
      `[ConsumeHandler] ${agentId}: arrived at target, consuming ${needType}`,
    );
    const result = systems.needs.requestConsume(agentId, needType);

    if (result.status === HandlerResultStatus.COMPLETED) {
      const resourceType = task.params?.resourceType as string;
      if (ctx.memory && resourceType && task.target.position) {
        ctx.memory.recordKnownResource(resourceType, task.target.position);
        logger.debug(
          `[ConsumeHandler] ${agentId}: recorded ${resourceType} at (${task.target.position.x?.toFixed(0)},${task.target.position.y?.toFixed(0)})`,
        );
      }
      return successResult({ satisfied: needType });
    }

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "No consumable resource available");
    }

    return inProgressResult("needs", "Consuming at resource location");
  }

  const result = systems.needs.requestConsume(agentId, needType);

  if (result.status === HandlerResultStatus.COMPLETED) {
    return successResult({ satisfied: needType });
  }

  if (result.status === HandlerResultStatus.FAILED) {
    logger.debug(
      `[ConsumeHandler] ${agentId}: consume failed - ${result.message}`,
    );
    return errorResult(result.message ?? "No consumable available");
  }

  if (
    result.status === HandlerResultStatus.IN_PROGRESS ||
    result.status === HandlerResultStatus.DELEGATED
  ) {
    return inProgressResult(
      result.system ?? "needs",
      result.message ?? "Looking for consumable",
    );
  }

  return errorResult("Consume operation returned unknown status");
}
