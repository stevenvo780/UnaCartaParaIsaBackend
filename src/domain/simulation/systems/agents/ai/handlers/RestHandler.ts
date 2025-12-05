/**
 * @fileoverview Handler de Descanso - Delegación a NeedsSystem
 *
 * Handler simplificado que delega el descanso al NeedsSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/RestHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { ActivityType } from "../../../../../../shared/constants/MovementEnums";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

/**
 * Maneja el descanso delegando al NeedsSystem.
 */
export function handleRest(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.REST) {
    return errorResult("Wrong task type");
  }

  if (!systems.needs) {
    return errorResult("NeedsSystem not available");
  }

  if (systems.movement) {
    systems.movement.startActivity(agentId, ActivityType.RESTING, 5000);
  }

  const result = systems.needs.requestRest(agentId);

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      if (systems.movement) {
        systems.movement.startActivity(agentId, ActivityType.IDLE);
      }
      return successResult({
        message: result.message ?? "Rested successfully",
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      if (systems.movement) {
        systems.movement.startActivity(agentId, ActivityType.IDLE);
      }
      return errorResult(result.message ?? "Rest failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("needs", result.message ?? "Resting");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to rest spot",
      );

    default:
      return inProgressResult("needs", "Processing rest");
  }
}
