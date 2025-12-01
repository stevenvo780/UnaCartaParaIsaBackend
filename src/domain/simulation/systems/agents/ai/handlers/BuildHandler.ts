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

// ============================================================================
// TYPES
// ============================================================================

/**
 * @deprecated Use SystemRegistry.building instead
 */
export interface BuildHandlerDeps {
  getConstruction?: (buildingId: string) => {
    id: string;
    progress: number;
    required: Record<string, number>;
    position: { x: number; y: number };
  } | null;
  contributeToConstruction?: (
    agentId: string,
    buildingId: string,
  ) => { contributed: boolean; amount: number };
  hasResourcesForBuild?: (
    agentId: string,
    requirements: Record<string, number>,
  ) => boolean;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Maneja la construcción delegando al BuildingSystem.
 */
export function handleBuild(
  ctx: HandlerContext,
  _deps?: BuildHandlerDeps, // Deprecated, ignorado
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  // Validar tipo
  if (task.type !== TaskType.BUILD) {
    return errorResult("Wrong task type");
  }

  // Validar sistema
  if (!systems.building) {
    return errorResult("BuildingSystem not available");
  }

  const buildingId = task.target?.entityId;
  const buildingType = task.params?.buildingType as string | undefined;

  // Si tiene buildingId → reparar/contribuir
  if (buildingId) {
    const result = systems.building.requestRepair(agentId, buildingId);

    switch (result.status) {
      case "completed":
        return successResult({
          buildingId,
          message: result.message ?? "Building complete",
          ...((result.data as object) ?? {}),
        });

      case "failed":
        return errorResult(result.message ?? "Build failed");

      case "in_progress":
        return inProgressResult("building", result.message ?? "Building");

      case "delegated":
        return inProgressResult(
          result.system,
          result.message ?? "Moving to building",
        );

      default:
        return inProgressResult("building", "Processing build");
    }
  }

  // Si tiene buildingType y posición → nueva construcción
  if (buildingType) {
    const targetPos = task.target?.position ?? position;
    const result = systems.building.requestBuild(
      agentId,
      buildingType,
      targetPos,
    );

    switch (result.status) {
      case "completed":
        return successResult({
          buildingType,
          position: targetPos,
          message: result.message,
          ...((result.data as object) ?? {}),
        });

      case "failed":
        return errorResult(result.message ?? "Cannot start construction");

      case "in_progress":
        return inProgressResult("building", result.message ?? "Constructing");

      case "delegated":
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
