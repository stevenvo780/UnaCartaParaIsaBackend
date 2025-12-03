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
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/**
 * @deprecated Use SystemRegistry.combat instead
 */
export interface FleeHandlerDeps {
  getEntityPosition?: (entityId: string) => { x: number; y: number } | null;
  moveToPoint?: (agentId: string, x: number, y: number) => boolean;
  getDistanceTo?: (agentId: string, targetId: string) => number;
}

/**
 * Maneja la huida delegando al CombatSystem.
 */
export function handleFlee(
  ctx: HandlerContext,
  _deps?: FleeHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  if (task.type !== TaskType.FLEE) {
    return errorResult("Wrong task type");
  }

  if (!systems.combat) {
    return errorResult("CombatSystem not available");
  }

  if (!task.target?.entityId && !task.target?.position) {
    return successResult({ message: "No threat to flee from" });
  }

  const fromPosition = task.target?.position ?? position;
  const result = systems.combat.requestFlee(agentId, fromPosition);

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      return successResult({
        message: result.message ?? "Escaped safely",
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Flee failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("combat", result.message ?? "Fleeing");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to safety",
      );

    default:
      return inProgressResult("combat", "Processing flee");
  }
}
