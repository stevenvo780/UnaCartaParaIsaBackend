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
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/**
 * Maneja el ataque delegando al CombatSystem.
 */
export function handleAttack(
  ctx: HandlerContext,
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;
  const targetId = task.target?.entityId;

  if (task.type !== TaskType.ATTACK && task.type !== TaskType.HUNT) {
    return errorResult("Wrong task type");
  }

  if (!systems.combat) {
    return errorResult("CombatSystem not available");
  }

  if (!targetId) {
    return errorResult("No attack target specified");
  }

  const result = systems.combat.requestAttack(agentId, targetId);

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      return successResult({
        targetId,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Attack failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("combat", result.message ?? "Attacking");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to target",
      );

    default:
      return inProgressResult("combat", "Processing attack");
  }
}
