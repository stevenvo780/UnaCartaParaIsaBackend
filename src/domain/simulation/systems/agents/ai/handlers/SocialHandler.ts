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
import { QuestStatus } from '../../../../../../shared/constants/QuestEnums';

/**
 * @deprecated Use SystemRegistry.social instead
 */
export interface SocialHandlerDeps {
  getEntityPosition?: (entityId: string) => { x: number; y: number } | null;
  interact?: (
    agentId: string,
    targetId: string,
  ) => { success: boolean; type: string };
  assist?: (
    agentId: string,
    targetId: string,
  ) => { success: boolean; helped: boolean };
  reproduce?: (
    agentId: string,
    partnerId: string,
  ) => { success: boolean; offspringId?: string };
  isCompatibleForReproduction?: (agentId: string, targetId: string) => boolean;
}

/**
 * Maneja interacciones sociales delegando al SocialSystem.
 */
export function handleSocialize(
  ctx: HandlerContext,
  _deps?: SocialHandlerDeps,
): HandlerExecutionResult {
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
    case "completed":
      return successResult({
        targetId,
        interactionType,
        message: result.message,
        ...((result.data as object) ?? {}),
      });

    case QuestStatus.FAILED:
      return errorResult(result.message ?? "Social interaction failed");

    case "in_progress":
      return inProgressResult("social", result.message ?? "Interacting");

    case "delegated":
      return inProgressResult(
        result.system,
        result.message ?? "Moving to target",
      );

    default:
      return inProgressResult("social", "Processing interaction");
  }
}
