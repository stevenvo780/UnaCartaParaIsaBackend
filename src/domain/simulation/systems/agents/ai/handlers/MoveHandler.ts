/**
 * @fileoverview Handler de Movimiento - Delegación a MovementSystem
 *
 * Handler simplificado que delega toda la lógica al MovementSystem.
 * Solo valida precondiciones y convierte resultados.
 *
 * @module domain/simulation/systems/agents/ai/handlers/MoveHandler
 */

import type {
  HandlerContext,
  HandlerExecutionResult,
  TaskTarget,
} from "../types";
import { errorResult, inProgressResult, successResult } from "../types";
import { QuestStatus } from '../../../../../../shared/constants/QuestEnums';
import { ActionType } from '../../../../../../shared/constants/AIEnums';

/** Distancia para considerar que llegó al destino */
const ARRIVAL_THRESHOLD = 1.5;

/**
 * Verifica si el agente está en el target
 */
export function isAtTarget(
  current: { x: number; y: number },
  target: { x: number; y: number },
  threshold: number = ARRIVAL_THRESHOLD,
): boolean {
  const dx = current.x - target.x;
  const dy = current.y - target.y;
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Calcula distancia entre dos puntos
 */
export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "Movement failed");
    }

    return inProgressResult("movement", "Moving to position");
  }

  if (target.zoneId) {
    const result = systems.movement.requestMoveToZone(agentId, target.zoneId);

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "Movement to zone failed");
    }

    if (result.status === "completed") {
      return successResult({ arrivedAtZone: target.zoneId });
    }

    return inProgressResult("movement", `Moving to zone ${target.zoneId}`);
  }

  if (target.entityId) {
    const result = systems.movement.requestMoveToEntity(
      agentId,
      target.entityId,
    );

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "Movement to entity failed");
    }

    if (result.status === "completed") {
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

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  if (isAtTarget(position, target)) {
    return successResult({ arrived: true });
  }

  const result = systems.movement.requestMove(agentId, target);

  if (result.status === QuestStatus.FAILED) {
    return errorResult(result.message ?? "Movement failed");
  }

  return inProgressResult("movement", "Moving to target");
}

/**
 * Solicita movimiento a una zona.
 */
export function moveToZone(
  ctx: HandlerContext,
  zoneId: string,
): HandlerExecutionResult {
  const { systems, agentId } = ctx;

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  const result = systems.movement.requestMoveToZone(agentId, zoneId);

  if (result.status === QuestStatus.FAILED) {
    return errorResult(result.message ?? "Movement to zone failed");
  }

  if (result.status === "completed") {
    return successResult({ arrivedAtZone: zoneId });
  }

  return inProgressResult("movement", `Moving to zone ${zoneId}`);
}

/**
 * Solicita movimiento hacia una entidad.
 */
export function moveToEntity(
  ctx: HandlerContext,
  entityId: string,
): HandlerExecutionResult {
  const { systems, agentId } = ctx;

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  const result = systems.movement.requestMoveToEntity(agentId, entityId);

  if (result.status === QuestStatus.FAILED) {
    return errorResult(result.message ?? "Movement to entity failed");
  }

  if (result.status === "completed") {
    return successResult({ arrivedAtEntity: entityId });
  }

  return inProgressResult("movement", `Moving to entity ${entityId}`);
}

/**
 * Detiene el movimiento del agente.
 */
export function stopMovement(ctx: HandlerContext): void {
  ctx.systems.movement?.stopMovement(ctx.agentId);
}

/**
 * Verifica si el agente está en movimiento.
 */
export function isMoving(ctx: HandlerContext): boolean {
  return ctx.systems.movement?.isMoving(ctx.agentId) ?? false;
}

/**
 * @deprecated Use moveToPosition with HandlerContext
 */
export function createMoveAction(_target: TaskTarget): {
  type: string;
  target: TaskTarget;
} {
  return { type: ActionType.MOVE, target: _target };
}
