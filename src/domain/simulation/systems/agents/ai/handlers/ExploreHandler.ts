/**
 * @fileoverview Handler de Exploración - Delegación a MovementSystem
 *
 * Handler que usa MovementSystem para explorar y registra descubrimientos
 * en la memoria del agente.
 *
 * @module domain/simulation/systems/agents/ai/handlers/ExploreHandler
 */

import { logger } from "@/infrastructure/utils/logger";
import type { HandlerContext, HandlerExecutionResult } from "../types";
import {
  TaskType,
  errorResult,
  inProgressResult,
  successResult,
} from "../types";
import { moveToPosition, isAtTarget } from "./MoveHandler";
import { QuestStatus } from "../../../../../../shared/constants/QuestEnums";

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

/** Radio de exploración al hacer movimientos aleatorios */
const EXPLORE_RADIUS = 50;

/**
 * Maneja la exploración usando MovementSystem.
 * Registra zonas visitadas y recursos descubiertos en la memoria del agente.
 */
export function handleExplore(
  ctx: HandlerContext,
  _deps?: ExploreHandlerDeps,
): HandlerExecutionResult {
  const { systems, agentId, task, position, memory } = ctx;
  
  logger.debug(`[ExploreHandler] ${agentId}: exploring, target=${JSON.stringify(task.target)}, pos=(${Math.round(position.x)},${Math.round(position.y)})`);

  if (task.type !== TaskType.EXPLORE) {
    return errorResult("Wrong task type");
  }

  if (!systems.movement) {
    return errorResult("MovementSystem not available");
  }

  // Exploración hacia posición específica
  if (task.target?.position) {
    if (isAtTarget(position, task.target.position)) {
      // Registrar la zona visitada si hay memoria disponible
      if (memory && task.target.zoneId) {
        memory.recordVisitedZone(task.target.zoneId);
      }
      
      return successResult({
        explored: task.target.position,
        message: "Arrived at exploration target",
      });
    }

    return moveToPosition(ctx, task.target.position);
  }

  // Exploración hacia zona específica
  if (task.target?.zoneId) {
    const result = systems.movement.requestMoveToZone(
      agentId,
      task.target.zoneId,
    );

    if (result.status === "completed") {
      // Registrar la zona como visitada
      if (memory) {
        memory.recordVisitedZone(task.target.zoneId);
      }
      
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

  // Sin target específico: exploración aleatoria inteligente
  // Intenta ir a una dirección que no haya visitado recientemente
  const randomTarget = generateExploreTarget(position);

  return moveToPosition(ctx, randomTarget);
}

/**
 * Genera un punto de exploración inteligente.
 * Intenta moverse en direcciones variadas para cubrir más área.
 */
function generateExploreTarget(
  currentPosition: { x: number; y: number }
): { x: number; y: number } {
  // Usar ángulos variados para explorar en diferentes direcciones
  const angle = Math.random() * Math.PI * 2;
  const distance = EXPLORE_RADIUS * (0.5 + Math.random() * 0.5);
  
  return {
    x: currentPosition.x + Math.cos(angle) * distance,
    y: currentPosition.y + Math.sin(angle) * distance,
  };
}
