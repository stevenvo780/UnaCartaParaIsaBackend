/**
 * @fileoverview Detector de Inventario
 *
 * Detecta cuando el inventario está lleno y debe depositar.
 * También detecta cuando tiene materiales de construcción que deben depositarse.
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

/** Umbral mínimo de materiales de construcción para depositar */
const BUILDING_MATERIAL_THRESHOLD = 3;

/**
 * Detecta necesidad de depositar recursos
 */
export function detectInventory(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  if (!ctx.inventoryLoad || !ctx.inventoryCapacity) return tasks;

  const loadRatio = ctx.inventoryLoad / ctx.inventoryCapacity;
  const inv = ctx.inventory ?? {};
  const woodCount = inv.wood_log ?? inv.wood ?? 0;
  const stoneCount = inv.stone ?? 0;

  // Umbral adaptativo: si hay demanda de construcción, depositar con 1+ materiales
  const effectiveThreshold = ctx.hasBuildingResourceDemand ? 1 : BUILDING_MATERIAL_THRESHOLD;

  // Detectar si tiene materiales de construcción que debería depositar
  const hasBuildingMaterials =
    woodCount >= effectiveThreshold ||
    stoneCount >= effectiveThreshold;

  // Caso 1: Inventario lleno sin zona de depósito
  if (
    loadRatio >= DEPOSIT_THRESHOLD &&
    !ctx.depositZoneId &&
    Math.random() < 0.02
  ) {
    logger.debug(
      `📦 [InventoryDetector] ${ctx.agentId}: full (${(loadRatio * 100).toFixed(0)}%) but no depositZone`,
    );
  }

  // Caso 2: Tiene materiales de construcción pero no zona de depósito
  if (hasBuildingMaterials && !ctx.depositZoneId && Math.random() < 0.02) {
    logger.debug(
      `📦 [InventoryDetector] ${ctx.agentId}: has building materials (wood=${woodCount}, stone=${stoneCount}) but no depositZone`,
    );
  }

  if (!ctx.depositZoneId) return tasks;

  // Generar tarea si:
  // 1. El inventario está lleno (>= DEPOSIT_THRESHOLD)
  // 2. O tiene materiales de construcción significativos
  // 3. O hay demanda de construcción y tiene algún material
  const shouldDeposit = loadRatio >= DEPOSIT_THRESHOLD || hasBuildingMaterials;

  if (!shouldDeposit) return tasks;

  // Prioridad más alta cuando hay demanda de construcción urgente
  // URGENT (0.8) para depósito con demanda de construcción > gather HIGH (0.6)
  const priority =
    loadRatio > URGENT_DEPOSIT_THRESHOLD
      ? TASK_PRIORITIES.URGENT
      : ctx.hasBuildingResourceDemand
        ? TASK_PRIORITIES.URGENT
        : hasBuildingMaterials && (woodCount >= 6 || stoneCount >= 6)
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
        hasFood: (inv.food ?? 0) > 0,
        hasWater: (inv.water ?? 0) > 0,
        hasBuildingMaterials,
        woodCount,
        stoneCount,
        forConstruction: ctx.hasBuildingResourceDemand,
      },
      source: "detector:inventory:deposit",
    }),
  );

  if (tasks.length > 0 && (Math.random() < 0.1 || ctx.hasBuildingResourceDemand)) {
    logger.debug(
      `📦 [InventoryDetector] ${ctx.agentId}: deposit task, load=${(loadRatio * 100).toFixed(0)}%, wood=${woodCount}, stone=${stoneCount}, forConstruction=${ctx.hasBuildingResourceDemand}`,
    );
  }

  return tasks;
}
