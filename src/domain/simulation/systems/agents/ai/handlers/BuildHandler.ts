/**
 * @fileoverview Handler de Construcción - Delegación a BuildingSystem
 *
 * Handler simplificado que delega la construcción al BuildingSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/BuildHandler
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
 * Maneja la construcción delegando al BuildingSystem.
 */
export function handleBuild(
  ctx: HandlerContext,
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  if (task.type !== TaskType.BUILD) {
    return errorResult("Wrong task type");
  }

  if (!systems.building) {
    return errorResult("BuildingSystem not available");
  }

  const buildingId = task.target?.entityId;
  const buildingType = task.params?.buildingType as string | undefined;

  if (buildingId) {
    const result = systems.building.requestRepair(agentId, buildingId);

    switch (result.status) {
      case HandlerResultStatus.COMPLETED:
        return successResult({
          buildingId,
          message: result.message ?? "Building complete",
          ...((result.data as object) ?? {}),
        });

      case HandlerResultStatus.FAILED:
        return errorResult(result.message ?? "Build failed");

      case HandlerResultStatus.IN_PROGRESS:
        return inProgressResult("building", result.message ?? "Building");

      case HandlerResultStatus.DELEGATED:
        return inProgressResult(
          result.system,
          result.message ?? "Moving to building",
        );

      default:
        return inProgressResult("building", "Processing build");
    }
  }

  if (buildingType) {
    const targetPos = task.target?.position ?? position;
    const result = systems.building.requestBuild(
      agentId,
      buildingType,
      targetPos,
    );

    switch (result.status) {
      case HandlerResultStatus.COMPLETED:
        return successResult({
          buildingType,
          position: targetPos,
          message: result.message,
          ...((result.data as object) ?? {}),
        });

      case HandlerResultStatus.FAILED:
        return errorResult(result.message ?? "Cannot start construction");

      case HandlerResultStatus.IN_PROGRESS:
        return inProgressResult("building", result.message ?? "Constructing");

      case HandlerResultStatus.DELEGATED:
        return inProgressResult(
          result.system,
          result.message ?? "Gathering materials",
        );

      default:
        return inProgressResult("building", "Processing construction");
    }
  }

  return errorResult("No building target or type specified");
}
