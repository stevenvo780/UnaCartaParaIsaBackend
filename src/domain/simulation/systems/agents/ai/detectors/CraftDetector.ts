/**
 * @fileoverview Detector de Crafteo
 *
 * Detecta cuando un agente necesita craftear algo (ej: arma).
 *
 * @module domain/simulation/systems/agents/ai/detectors/CraftDetector
 */

import {
  type Task,
  type DetectorContext,
  TaskType,
  TASK_PRIORITIES,
  createTask,
} from "../types";

// ============================================================================
// DETECTOR
// ============================================================================

/**
 * Detecta necesidad de craftear
 */
export function detectCraft(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  // Detectar necesidad de arma
  const needsWeapon = detectWeaponNeed(ctx);
  if (needsWeapon) {
    tasks.push(needsWeapon);
  }

  return tasks;
}

// ============================================================================
// SUB-DETECTORS
// ============================================================================

function detectWeaponNeed(ctx: DetectorContext): Task | null {
  // Ya tiene arma
  if (ctx.hasWeapon || ctx.equippedWeapon !== "unarmed") return null;

  // No puede craftear ninguna
  if (!ctx.canCraftClub && !ctx.canCraftDagger) return null;

  // No hay zona de crafteo
  if (!ctx.craftZoneId) return null;

  // Determinar prioridad según rol
  const role = (ctx.roleType ?? "").toLowerCase();
  const needsWeaponForRole =
    role === "hunter" || role === "guard" || role === "warrior";

  const weaponToCraft = ctx.canCraftDagger ? "stone_dagger" : "wooden_club";

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.CRAFT,
    priority: needsWeaponForRole
      ? TASK_PRIORITIES.URGENT
      : TASK_PRIORITIES.NORMAL,
    target: { zoneId: ctx.craftZoneId },
    params: {
      itemType: "weapon",
      itemId: weaponToCraft,
      roleNeedsWeapon: needsWeaponForRole,
    },
    source: "detector:craft:weapon",
  });
}
