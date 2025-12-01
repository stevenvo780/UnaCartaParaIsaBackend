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

// ============================================================================
// TYPES
// ============================================================================

/**
 * @deprecated Use SystemRegistry.inventory instead
 */
export interface GatherHandlerDeps {
  harvestResource?: (
    agentId: string,
    resourceId: string,
    amount: number,
  ) => boolean;
  getResourceAt?: (
    x: number,
    y: number,
  ) => { id: string; type: string; amount: number } | null;
  addToInventory?: (
    agentId: string,
    itemType: string,
    amount: number,
  ) => boolean;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Maneja la recolección delegando al InventorySystem.
 */
export function handleGather(
  ctx: HandlerContext,
  _deps?: GatherHandlerDeps, // Deprecated, ignorado
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;
  const target = task.target;

  // Validar tipo de tarea
  if (task.type !== TaskType.GATHER) {
    return errorResult("Wrong task type");
  }

  // Validar sistema disponible
  if (!systems.inventory) {
    return errorResult("InventorySystem not available");
  }

  // Validar target
  if (!target?.position && !target?.entityId) {
    return errorResult("No gather target specified");
  }

  // Si tiene posición target, verificar si llegó
  if (target.position) {
    if (!isAtTarget(position, target.position)) {
      return moveToPosition(ctx, target.position);
    }
  }

  // Si tiene entityId (recurso específico), moverse hacia él
  if (target.entityId && !target.position) {
    if (!systems.movement) {
      return errorResult("MovementSystem not available");
    }

    const moveResult = systems.movement.requestMoveToEntity(
      agentId,
      target.entityId,
    );

    if (moveResult.status === "in_progress") {
      return inProgressResult("movement", "Moving to resource");
    }

    if (moveResult.status === "failed") {
      return errorResult(moveResult.message ?? "Cannot reach resource");
    }
  }

  // En posición → delegar recolección al sistema
  const resourceId = target.entityId ?? (task.params?.resourceId as string);
  const quantity = (task.params?.amount as number) ?? 1;

  if (!resourceId) {
    return errorResult("No resource ID specified");
  }

  const result = systems.inventory.requestGather(agentId, resourceId, quantity);

  if (result.status === "completed") {
    return successResult({
      gathered: resourceId,
      quantity,
    });
  }

  if (result.status === "failed") {
    return errorResult(result.message ?? "Gather failed");
  }

  return inProgressResult("inventory", "Gathering resource");
}
