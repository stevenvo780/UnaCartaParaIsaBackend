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
import { QuestStatus } from '../../../../../../shared/constants/QuestEnums';

/**
 * @deprecated Use SystemRegistry.needs instead
 */
export interface RestHandlerDeps {
  findNearestRestSpot?: (
    agentId: string,
  ) => { id: string; position: { x: number; y: number }; bonus: number } | null;
  startResting?: (agentId: string) => boolean;
  stopResting?: (agentId: string) => void;
  isResting?: (agentId: string) => boolean;
  getEnergy?: (agentId: string) => number;
}

/**
 * Maneja el descanso delegando al NeedsSystem.
 */
export function handleRest(
  ctx: HandlerContext,
  _deps?: RestHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.REST) {
    return errorResult("Wrong task type");
  }

  if (!systems.needs) {
    return errorResult("NeedsSystem not available");
  }

  const result = systems.needs.requestRest(agentId);

  switch (result.status) {
    case "completed":
      return successResult({
        message: result.message ?? "Rested successfully",
        ...((result.data as object) ?? {}),
      });

    case QuestStatus.FAILED:
      return errorResult(result.message ?? "Rest failed");

    case "in_progress":
      return inProgressResult("needs", result.message ?? "Resting");

    case "delegated":
      return inProgressResult(
        result.system,
        result.message ?? "Moving to rest spot",
      );

    default:
      return inProgressResult("needs", "Processing rest");
  }
}
