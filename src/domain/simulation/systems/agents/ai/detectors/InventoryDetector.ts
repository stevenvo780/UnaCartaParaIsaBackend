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

// Use centralized inventory thresholds
const DEPOSIT_THRESHOLD = SIMULATION_CONSTANTS.INVENTORY_THRESHOLDS.DEPOSIT_THRESHOLD;
const URGENT_DEPOSIT_THRESHOLD = SIMULATION_CONSTANTS.INVENTORY_THRESHOLDS.URGENT_DEPOSIT_THRESHOLD;

/**
 * Detecta necesidad de depositar recursos
 */
export function detectInventory(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.inventoryLoad || !ctx.inventoryCapacity) return tasks;
  if (!ctx.depositZoneId) return tasks;

  const loadRatio = ctx.inventoryLoad / ctx.inventoryCapacity;

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
      target: { zoneId: ctx.depositZoneId },
      params: {
        loadRatio,
        hasFood: (ctx.inventory?.food ?? 0) > 0,
        hasWater: (ctx.inventory?.water ?? 0) > 0,
      },
      source: "detector:inventory:deposit",
    }),
  );

  return tasks;
}
