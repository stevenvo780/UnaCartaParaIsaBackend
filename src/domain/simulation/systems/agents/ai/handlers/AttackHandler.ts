/**
 * @fileoverview Handler de Ataque - Delegación a CombatSystem
 *
 * Handler simplificado que delega el combate al CombatSystem.
 * Solo valida precondiciones y coordina movimiento + ataque.
 *
 * @module domain/simulation/systems/agents/ai/handlers/AttackHandler
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
export interface AttackHandlerDeps {
  attackEntity?: (
    attackerId: string,
    targetId: string,
  ) => { hit: boolean; damage: number };
  getEntityHealth?: (entityId: string) => number;
  getEntityPosition?: (entityId: string) => { x: number; y: number } | null;
  isInRange?: (agentId: string, targetId: string, range: number) => boolean;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Maneja el ataque delegando al CombatSystem.
 */
export function handleAttack(
  ctx: HandlerContext,
  _deps?: AttackHandlerDeps, // Deprecated, ignorado
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;
  const targetId = task.target?.entityId;

  // Validar tipo
  if (task.type !== TaskType.ATTACK && task.type !== TaskType.HUNT) {
    return errorResult("Wrong task type");
  }

  // Validar sistema
  if (!systems.combat) {
    return errorResult("CombatSystem not available");
  }

  // Validar target
  if (!targetId) {
    return errorResult("No attack target specified");
  }

  // Delegar completamente al CombatSystem
  // El sistema se encarga de: verificar rango, mover si es necesario, atacar
  const result = systems.combat.requestAttack(agentId, targetId);

  switch (result.status) {
    case "completed":
      return successResult({
        targetId,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case "failed":
      return errorResult(result.message ?? "Attack failed");

    case "in_progress":
      return inProgressResult("combat", result.message ?? "Attacking");

    case "delegated":
      // El sistema delegó a movimiento para acercarse
      return inProgressResult(
        result.system,
        result.message ?? "Moving to target",
      );

    default:
      return inProgressResult("combat", "Processing attack");
  }
}
