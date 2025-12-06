/**
 * @fileoverview Handler de Recolección - Delegación a InventorySystem
 *
 * Handler simplificado que delega la recolección al InventorySystem.
 * Solo valida precondiciones y coordina movimiento + recolección.
 *
 * @module domain/simulation/systems/agents/ai/handlers/GatherHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { isAtTarget, moveToPosition } from "./MoveHandler";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";
import { logger } from "@/infrastructure/utils/logger";

/**
 * Maneja la recolección delegando al InventorySystem.
 */
export function handleGather(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;
  const target = task.target;

  logger.debug(
    `🌲 [GatherHandler] ${agentId}: entering handler, target=${JSON.stringify(target)}`,
  );

  if (task.type !== TaskType.GATHER) {
    return errorResult("Wrong task type");
  }

  if (!systems.inventory) {
    return errorResult("InventorySystem not available");
  }

  if (!target?.position && !target?.entityId) {
    logger.debug(`🌲 [GatherHandler] ${agentId}: No gather target specified`);
    return errorResult("No gather target specified");
  }

  if (target.position) {
    if (!isAtTarget(position, target.position)) {
      logger.debug(
        `🌲 [GatherHandler] ${agentId}: Moving to resource at ${JSON.stringify(target.position)}`,
      );
      return moveToPosition(ctx, target.position);
    }
  }

  if (target.entityId && !target.position) {
    if (!systems.movement) {
      return errorResult("MovementSystem not available");
    }

    const moveResult = systems.movement.requestMoveToEntity(
      agentId,
      target.entityId,
    );

    if (moveResult.status === HandlerResultStatus.IN_PROGRESS) {
      logger.debug(
        `🌲 [GatherHandler] ${agentId}: Moving to entity ${target.entityId}`,
      );
      return inProgressResult("movement", "Moving to resource");
    }

    if (moveResult.status === HandlerResultStatus.FAILED) {
      logger.debug(
        `🌲 [GatherHandler] ${agentId}: Cannot reach resource: ${moveResult.message}`,
      );
      return errorResult(moveResult.message ?? "Cannot reach resource");
    }
  }

  const resourceId = target.entityId ?? (task.params?.resourceId as string);
  const quantity = (task.params?.amount as number) ?? 1;

  if (!resourceId) {
    logger.debug(`🌲 [GatherHandler] ${agentId}: No resource ID specified`);
    return errorResult("No resource ID specified");
  }

  logger.debug(
    `🌲 [GatherHandler] ${agentId}: requestGather(${resourceId}, ${quantity})`,
  );
  const result = systems.inventory.requestGather(agentId, resourceId, quantity);

  if (result.status === HandlerResultStatus.COMPLETED) {
    const resourceType = task.params?.resourceType as string;
    if (ctx.memory && resourceType && target.position) {
      ctx.memory.recordKnownResource(resourceType, target.position);
    }
    // Log the actual message from InventorySystem which includes secondaryYields
    logger.info(
      `🌲 [GatherHandler] ${agentId}: ${result.message ?? `GATHERED ${quantity} from ${resourceId}`}`,
    );
    return successResult({
      gathered: resourceId,
      quantity,
      secondaryYields: (result.data as Record<string, unknown>)?.secondaryYields,
    });
  }

  if (result.status === HandlerResultStatus.FAILED) {
    logger.debug(
      `🌲 [GatherHandler] ${agentId}: Gather FAILED: ${result.message}`,
    );
    return errorResult(result.message ?? "Gather failed");
  }

  logger.debug(`🌲 [GatherHandler] ${agentId}: Gathering in progress...`);
  return inProgressResult("inventory", "Gathering resource");
}
