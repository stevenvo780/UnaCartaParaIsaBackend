/**
 * @fileoverview Handler de Huida - Delegación a CombatSystem
 *
 * Handler simplificado que delega la huida al CombatSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/FleeHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * @deprecated Use SystemRegistry.combat instead
 */
export interface FleeHandlerDeps {
  getEntityPosition?: (entityId: string) => { x: number; y: number } | null;
  moveToPoint?: (agentId: string, x: number, y: number) => boolean;
  getDistanceTo?: (agentId: string, targetId: string) => number;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Maneja la huida delegando al CombatSystem.
 */
export function handleFlee(
  ctx: HandlerContext,
  _deps?: FleeHandlerDeps, // Deprecated, ignorado
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  // Validar tipo
  if (task.type !== TaskType.FLEE) {
    return errorResult("Wrong task type");
  }

  // Validar sistema
  if (!systems.combat) {
    return errorResult("CombatSystem not available");
  }

  // Sin amenaza → completado
  if (!task.target?.entityId && !task.target?.position) {
    return successResult({ message: "No threat to flee from" });
  }

  // Delegar al CombatSystem
  const fromPosition = task.target?.position ?? position;
  const result = systems.combat.requestFlee(agentId, fromPosition);

  switch (result.status) {
    case "completed":
      return successResult({
        message: result.message ?? "Escaped safely",
        ...((result.data as object) ?? {}),
      });

    case "failed":
      return errorResult(result.message ?? "Flee failed");

    case "in_progress":
      return inProgressResult("combat", result.message ?? "Fleeing");

    case "delegated":
      return inProgressResult(
        result.system,
        result.message ?? "Moving to safety",
      );

    default:
      return inProgressResult("combat", "Processing flee");
  }
}
