/**
 * @fileoverview Detector de Comercio
 *
 * Detecta cuando un agente debería comerciar.
 *
 * @module domain/simulation/systems/agents/ai/detectors/TradeDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";

/**
 * Detecta oportunidades de comercio
 */
export function detectTrade(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.hasExcessResources) return tasks;
  if (!ctx.nearestMarketZoneId) return tasks;

  const isTrader = (ctx.roleType ?? "").toLowerCase() === "trader";

  tasks.push(
    createTask({
      agentId: ctx.agentId,
      type: TaskType.TRADE,
      priority: isTrader ? TASK_PRIORITIES.NORMAL : TASK_PRIORITIES.LOW,
      target: { zoneId: ctx.nearestMarketZoneId },
      params: { action: "trade" },
      source: "detector:trade",
    }),
  );

  return tasks;
}
