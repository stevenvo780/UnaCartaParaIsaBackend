/**
 * @fileoverview Handler de Exploración - Delegación a MovementSystem
 *
 * Handler que usa MovementSystem para explorar y registra descubrimientos
 * en la memoria del agente.
 *
 * @module domain/simulation/systems/agents/ai/handlers/ExploreHandler
 */

import { logger } from "@/infrastructure/utils/logger";
import { RandomUtils } from "@/shared/utils/RandomUtils";
import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { moveToPosition, isAtTarget } from "./MoveHandler";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/** Radio de exploración al hacer movimientos aleatorios - aumentado para encontrar nuevos chunks */
const EXPLORE_RADIUS = 200;

/**
 * Maneja la exploración usando MovementSystem.
 * Registra zonas visitadas y recursos descubiertos en la memoria del agente.
 */
export function handleExplore(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task, position, memory } = ctx;

  logger.debug(
    `[ExploreHandler] ${agentId}: exploring, target=${JSON.stringify(task.target)}, pos=(${Math.round(position.x)},${Math.round(position.y)})`,
  );

  if (task.type !== TaskType.EXPLORE) {
    return errorResult("Wrong task type");
  }

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  if (task.target?.position) {
    if (isAtTarget(position, task.target.position)) {
      if (memory && task.target.zoneId) {
        memory.recordVisitedZone(task.target.zoneId);
      }

      if (memory) {
        memory.recordExploration();
      }

      return successResult({
        explored: task.target.position,
        message: "Arrived at exploration target",
      });
    }

    return moveToPosition(ctx, task.target.position);
  }

  if (task.target?.zoneId) {
    const result = systems.movement.requestMoveToZone(
      agentId,
      task.target.zoneId,
    );

    if (result.status === HandlerResultStatus.COMPLETED) {
      if (memory) {
        memory.recordVisitedZone(task.target.zoneId);
        memory.recordExploration();
      }

      return successResult({
        exploredZone: task.target.zoneId,
        message: "Arrived at exploration zone",
      });
    }

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "Cannot reach exploration zone");
    }

    return inProgressResult("movement", "Exploring zone");
  }

  if (task.params?.preferEdge && systems.worldQuery) {
    const edgeTarget = systems.worldQuery.getDirectionToNearestEdge(
      position.x,
      position.y,
    );

    const distanceToEdge = Math.hypot(
      edgeTarget.x - position.x,
      edgeTarget.y - position.y,
    );

    // Prevent division by zero which causes NaN positions
    if (distanceToEdge < 1) {
      logger.debug(
        `[ExploreHandler] ${agentId}: already at edge, generating random explore target`,
      );
      const randomTarget = generateExploreTarget(position);
      return moveToPosition(ctx, randomTarget);
    }

    const stepDistance = Math.min(150, distanceToEdge);
    const ratio = stepDistance / distanceToEdge;

    const stepTarget = {
      x: position.x + (edgeTarget.x - position.x) * ratio,
      y: position.y + (edgeTarget.y - position.y) * ratio,
    };

    // Validate stepTarget to prevent NaN propagation
    if (!Number.isFinite(stepTarget.x) || !Number.isFinite(stepTarget.y)) {
      logger.warn(
        `[ExploreHandler] ${agentId}: invalid stepTarget (${stepTarget.x}, ${stepTarget.y}), using random target`,
      );
      const randomTarget = generateExploreTarget(position);
      return moveToPosition(ctx, randomTarget);
    }

    logger.debug(
      `[ExploreHandler] ${agentId}: searching water, moving toward ${edgeTarget.edgeName} edge (${Math.round(stepTarget.x)}, ${Math.round(stepTarget.y)})`,
    );

    return moveToPosition(ctx, stepTarget);
  }

  const randomTarget = generateExploreTarget(position);

  return moveToPosition(ctx, randomTarget);
}

/**
 * Genera un punto de exploración inteligente.
 * Intenta moverse en direcciones variadas para cubrir más área.
 */
function generateExploreTarget(currentPosition: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const angle = RandomUtils.floatRange(0, Math.PI * 2);
  const distance = EXPLORE_RADIUS * (0.5 + RandomUtils.floatRange(0, 0.5));

  return {
    x: currentPosition.x + Math.cos(angle) * distance,
    y: currentPosition.y + Math.sin(angle) * distance,
  };
}
