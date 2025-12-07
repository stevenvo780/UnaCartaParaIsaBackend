/**
 * @fileoverview Handler de Movimiento - Delegación a MovementSystem
 *
 * Handler simplificado que delega toda la lógica al MovementSystem.
 * Solo valida precondiciones y convierte resultados.
 *
 * @module domain/simulation/systems/agents/ai/handlers/MoveHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import { errorResult, inProgressResult, successResult } from "../types";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";
import {
  distance as sharedDistance,
  isWithinDistance,
} from "@/shared/utils/mathUtils";
import { logger } from "@/infrastructure/utils/logger";

/** Distancia para considerar que llegó al destino (debe ser >= 2 del MovementSystem) */
const ARRIVAL_THRESHOLD = 3.0;

/**
 * Verifica si el agente está en el target
 */
export function isAtTarget(
  current: { x: number; y: number },
  target: { x: number; y: number },
  threshold: number = ARRIVAL_THRESHOLD,
): boolean {
  return isWithinDistance(current, target, threshold);
}

/**
 * Maneja solicitudes de movimiento delegando al MovementSystem.
 *
 * No implementa lógica de pathfinding - eso es responsabilidad del sistema.
 */
export function handleMove(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  const target = task.target;

  if (!target) {
    return errorResult("No movement target specified");
  }

  if (target.position) {
    if (isAtTarget(position, target.position)) {
      return successResult({ arrivedAt: target.position });
    }

    const result = systems.movement.requestMove(agentId, target.position);

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "Movement failed");
    }

    return inProgressResult("movement", "Moving to position");
  }

  if (target.zoneId) {
    const result = systems.movement.requestMoveToZone(agentId, target.zoneId);

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "Movement to zone failed");
    }

    if (result.status === HandlerResultStatus.COMPLETED) {
      return successResult({ arrivedAtZone: target.zoneId });
    }

    return inProgressResult("movement", `Moving to zone ${target.zoneId}`);
  }

  if (target.entityId) {
    const result = systems.movement.requestMoveToEntity(
      agentId,
      target.entityId,
    );

    if (result.status === HandlerResultStatus.FAILED) {
      return errorResult(result.message ?? "Movement to entity failed");
    }

    if (result.status === HandlerResultStatus.COMPLETED) {
      return successResult({ arrivedAtEntity: target.entityId });
    }

    return inProgressResult("movement", `Moving to entity ${target.entityId}`);
  }

  return errorResult("Invalid movement target");
}

/**
 * Solicita movimiento a una posición específica.
 * Helper para otros handlers que necesitan mover al agente primero.
 */
export function moveToPosition(
  ctx: HandlerContext,
  target: { x: number; y: number },
): HandlerExecutionResult {
  const { systems, agentId, position } = ctx;

  // Validate target coordinates to prevent NaN propagation
  if (
    !target ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  ) {
    logger.warn(
      `[MoveHandler] ${agentId}: invalid target coordinates (${target?.x}, ${target?.y}), aborting move`,
    );
    return errorResult("Invalid target coordinates");
  }

  // Validate current position
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    logger.warn(
      `[MoveHandler] ${agentId}: invalid current position (${position?.x}, ${position?.y}), aborting move`,
    );
    return errorResult("Invalid current position");
  }

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  const dist = sharedDistance(position, target);

  if (isAtTarget(position, target)) {
    return successResult({ arrived: true });
  }

  const result = systems.movement.requestMove(agentId, target);

  if (dist > 100) {
    logger.debug(
      `[MoveHandler] ${agentId}: moveToPosition dist=${dist.toFixed(0)}, result.status=${result.status}, msg=${result.message}`,
    );
  }

  if (result.status === HandlerResultStatus.FAILED) {
    return errorResult(result.message ?? "Movement failed");
  }

  return inProgressResult("movement", "Moving to target");
}

/**
 * Solicita movimiento a una zona.
 */
