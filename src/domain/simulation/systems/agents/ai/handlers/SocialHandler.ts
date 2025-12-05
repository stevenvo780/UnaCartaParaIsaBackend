/**
 * @fileoverview Handler Social - Delegación a SocialSystem
 *
 * Handler simplificado que delega las interacciones al SocialSystem.
 * Solo valida precondiciones y delega.
 *
 * @module domain/simulation/systems/agents/ai/handlers/SocialHandler
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
 * Maneja interacciones sociales delegando al SocialSystem.
 */
export function handleSocialize(ctx: HandlerContext): HandlerExecutionResult {
  const { systems, agentId, task } = ctx;
  const targetId = task.target?.entityId;

  if (task.type !== TaskType.SOCIALIZE && task.type !== TaskType.ASSIST) {
    return errorResult("Wrong task type");
  }

  if (!systems.social) {
    return errorResult("SocialSystem not available");
  }

  if (!targetId) {
    return errorResult("No social target specified");
  }

  const interactionType =
    (task.params?.action as string) ??
    (task.type === TaskType.ASSIST ? "assist" : "chat");

  const result = systems.social.requestInteraction(
    agentId,
    targetId,
    interactionType,
  );

  switch (result.status) {
    case HandlerResultStatus.COMPLETED:
      return successResult({
        targetId,
        interactionType,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case HandlerResultStatus.FAILED:
      return errorResult(result.message ?? "Social interaction failed");

    case HandlerResultStatus.IN_PROGRESS:
      return inProgressResult("social", result.message ?? "Interacting");

    case HandlerResultStatus.DELEGATED:
      return inProgressResult(
        result.system,
        result.message ?? "Moving to target",
      );

    default:
      return inProgressResult("social", "Processing interaction");
  }
}
