/**
 * @fileoverview Detector de Inventario
 *
 * Detecta cuando el inventario está lleno y debe depositar.
 *
 * @module domain/simulation/systems/agents/ai/detectors/InventoryDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";
import { SIMULATION_CONSTANTS } from "../../../../../../shared/constants/SimulationConstants";
import { logger } from "@/infrastructure/utils/logger";

const DEPOSIT_THRESHOLD =
  SIMULATION_CONSTANTS.INVENTORY_THRESHOLDS.DEPOSIT_THRESHOLD;
const URGENT_DEPOSIT_THRESHOLD =
  SIMULATION_CONSTANTS.INVENTORY_THRESHOLDS.URGENT_DEPOSIT_THRESHOLD;

/**
 * Detecta necesidad de depositar recursos
 */
export function detectInventory(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.inventoryLoad || !ctx.inventoryCapacity) return tasks;

  const loadRatio = ctx.inventoryLoad / ctx.inventoryCapacity;

  // Log cuando inventario está lleno pero no hay zona de depósito
  if (
    loadRatio >= DEPOSIT_THRESHOLD &&
    !ctx.depositZoneId &&
    Math.random() < 0.02
  ) {
    logger.debug(
      `📦 [InventoryDetector] ${ctx.agentId}: full (${(loadRatio * 100).toFixed(0)}%) but no depositZone`,
    );
  }

  if (!ctx.depositZoneId) return tasks;

  if (loadRatio < DEPOSIT_THRESHOLD) return tasks;

  const priority =
    loadRatio > URGENT_DEPOSIT_THRESHOLD
      ? TASK_PRIORITIES.HIGH
      : TASK_PRIORITIES.NORMAL;

  tasks.push(
    createTask({
      agentId: ctx.agentId,
      type: TaskType.DEPOSIT,
      priority,
      target: { entityId: ctx.depositZoneId, zoneId: ctx.depositZoneId },
      params: {
        loadRatio,
        hasFood: (ctx.inventory?.food ?? 0) > 0,
        hasWater: (ctx.inventory?.water ?? 0) > 0,
      },
      source: "detector:inventory:deposit",
    }),
  );

  if (tasks.length > 0 && Math.random() < 0.1) {
    logger.debug(
      `📦 [InventoryDetector] ${ctx.agentId}: deposit task, load=${(loadRatio * 100).toFixed(0)}%`,
    );
  }

  return tasks;
}
