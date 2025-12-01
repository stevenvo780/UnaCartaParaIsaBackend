/**
 * @fileoverview Handler de Exploración - Delegación a MovementSystem
 *
 * Handler simplificado que usa MovementSystem para explorar.
 * Solo valida y coordina movimiento hacia áreas inexploradas.
 *
 * @module domain/simulation/systems/agents/ai/handlers/ExploreHandler
 */

import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { moveToPosition, isAtTarget } from "./MoveHandler";
import { QuestStatus } from '../../../../../../shared/constants/QuestEnums';

/**
 * @deprecated Use MovementSystem directly
 */
export interface ExploreHandlerDeps {
  getUnexploredPosition?: (agentId: string) => { x: number; y: number } | null;
  markAsExplored?: (
    agentId: string,
    x: number,
    y: number,
    radius: number,
  ) => void;
  getExplorationProgress?: (agentId: string) => number;
}

/**
 * Maneja la exploración usando MovementSystem.
 *
 * Nota: La exploración es principalmente movimiento a ubicaciones random.
 * El sistema de memoria del agente trackea las zonas visitadas.
 */
export function handleExplore(
  ctx: HandlerContext,
  _deps?: ExploreHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task, position } = ctx;

  if (task.type !== TaskType.EXPLORE) {
    return errorResult("Wrong task type");
  }

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  if (task.target?.position) {
    if (isAtTarget(position, task.target.position)) {
      return successResult({
        explored: task.target.position,
        message: "Arrived at exploration target",
      });
    }

    return moveToPosition(ctx, task.target.position);
  }

  if (task.target?.zoneId) {
    const result = systems.movement.requestMoveToZone(
      agentId,
      task.target.zoneId,
    );

    if (result.status === "completed") {
      return successResult({
        exploredZone: task.target.zoneId,
        message: "Arrived at exploration zone",
      });
    }

    if (result.status === QuestStatus.FAILED) {
      return errorResult(result.message ?? "Cannot reach exploration zone");
    }

    return inProgressResult("movement", "Exploring zone");
  }

  const randomOffset = () => (Math.random() - 0.5) * 20;
  const randomTarget = {
    x: position.x + randomOffset(),
    y: position.y + randomOffset(),
  };

  return moveToPosition(ctx, randomTarget);
}
