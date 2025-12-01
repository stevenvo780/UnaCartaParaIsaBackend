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

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Maneja el consumo delegando al NeedsSystem.
 */
export function handleConsume(
  ctx: HandlerContext,
  _deps?: ConsumeHandlerDeps, // Deprecated, ignorado
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  // Validar tipo
  if (task.type !== TaskType.SATISFY_NEED) {
    return errorResult("Wrong task type");
  }

  // Validar sistema
  if (!systems.needs) {
    return errorResult("NeedsSystem not available");
  }

  const needType = task.params?.needType as string | undefined;
  const itemId = task.params?.itemId as string | undefined;

  if (!needType) {
    return errorResult("No need type specified");
  }

  // Si tiene item específico → consumir directamente
  if (itemId) {
    const result = systems.needs.requestConsume(agentId, itemId);

    if (result.status === "completed") {
      return successResult({
        consumed: itemId,
        satisfied: needType,
      });
    }

    if (result.status === "failed") {
      return errorResult(result.message ?? "Consume failed");
    }

    return inProgressResult("needs", "Consuming item");
  }

  // Si tiene target position (ir a recurso) → moverse primero
  if (task.target?.position) {
    if (!isAtTarget(position, task.target.position)) {
      return moveToPosition(ctx, task.target.position);
    }

    // Llegó al recurso → el sistema de necesidades debe auto-consumir
    // Delegar al NeedsSystem para que busque y consuma
    const result = systems.needs.requestConsume(agentId, needType);

    if (result.status === "completed") {
      return successResult({ satisfied: needType });
    }

    if (result.status === "failed") {
      return errorResult(result.message ?? "No consumable resource available");
    }

    return inProgressResult("needs", "Consuming at resource location");
  }

  // Sin item ni target → pedir al sistema que busque algo que consumir
  const result = systems.needs.requestConsume(agentId, needType);

  if (result.status === "completed") {
    return successResult({ satisfied: needType });
  }

  if (result.status === "failed") {
    return errorResult(result.message ?? "No consumable available");
  }

  return inProgressResult("needs", "Looking for consumable");
}
