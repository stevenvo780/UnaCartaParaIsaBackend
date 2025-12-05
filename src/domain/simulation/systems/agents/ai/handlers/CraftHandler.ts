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
import { logger } from "@/infrastructure/utils/logger";

export interface Recipe {
  itemType: string;
  ingredients: Record<string, number>;
  stationRequired?: string;
}

/**
 * Maneja el crafteo delegando al CraftingSystem.
 */
export function handleCraft(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;

  if (task.type !== TaskType.CRAFT) {
    logger.debug(`[CraftHandler] ${agentId}: Wrong task type ${task.type}`);
    return errorResult("Wrong task type");
  }

  if (!systems.crafting) {
    logger.warn(`[CraftHandler] ${agentId}: CraftingSystem not available`);
    return errorResult("CraftingSystem not available");
  }

  // Try multiple param names for recipe: recipeId, itemId, itemType
  const recipeId =
    (task.params?.recipeId as string) ??
    (task.params?.itemId as string) ??
    (task.params?.itemType as string);

  if (!recipeId) {
    logger.debug(
      `[CraftHandler] ${agentId}: No recipe specified, params=${JSON.stringify(task.params)}`,
    );
    return errorResult("No recipe specified");
  }

  logger.debug(`[CraftHandler] ${agentId}: Attempting to craft ${recipeId}`);

  if (!systems.crafting.canCraft(agentId, recipeId)) {
    logger.debug(`[CraftHandler] ${agentId}: canCraft=false for ${recipeId}`);
    return errorResult("Cannot craft: missing ingredients or station");
  }

  const result = systems.crafting.requestCraft(agentId, recipeId);
  logger.info(
    `[CraftHandler] ${agentId}: requestCraft(${recipeId}) = ${result.status} - ${result.message}`,
  );

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      logger.info(`✅ [CraftHandler] ${agentId}: CRAFTED ${recipeId}!`);
      return successResult({
        crafted: recipeId,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      logger.debug(
        `[CraftHandler] ${agentId}: Craft failed - ${result.message}`,
      );
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
