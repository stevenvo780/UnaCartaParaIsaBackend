/**
 * @fileoverview Handler de Crafteo - Delegación a CraftingSystem
 *
 * Handler simplificado que delega el crafteo al CraftingSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/CraftHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";

export interface Recipe {
  itemType: string;
  ingredients: Record<string, number>;
  stationRequired?: string;
}

/**
 * Maneja el crafteo delegando al CraftingSystem.
 */
export function handleCraft(
  ctx: HandlerContext,
): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.CRAFT) {
    return errorResult("Wrong task type");
  }

  if (!systems.crafting) {
    return errorResult("CraftingSystem not available");
  }

  const recipeId =
    (task.params?.recipeId as string) ?? (task.params?.itemType as string);

  if (!recipeId) {
    return errorResult("No recipe specified");
  }

  if (!systems.crafting.canCraft(agentId, recipeId)) {
    return errorResult("Cannot craft: missing ingredients or station");
  }

  const result = systems.crafting.requestCraft(agentId, recipeId);

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      return successResult({
        crafted: recipeId,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Craft failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("crafting", result.message ?? "Crafting");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to crafting station",
      );

    default:
      return inProgressResult("crafting", "Processing craft");
  }
}
