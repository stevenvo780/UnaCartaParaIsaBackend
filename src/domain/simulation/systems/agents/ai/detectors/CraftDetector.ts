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
import { RoleType } from "../../../../../../shared/constants/RoleEnums";
import { SocialStatus } from "../../../../../../shared/constants/AgentEnums";
import { ItemCategory } from "../../../../../../shared/constants/ItemEnums";
import { WeaponId } from "@/shared/constants/CraftingEnums";
/**
 * Detecta necesidad de craftear
 */
export function detectCraft(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  const needsWeapon = detectWeaponNeed(ctx);
  if (needsWeapon) {
    tasks.push(needsWeapon);
  }

  return tasks;
}

function detectWeaponNeed(ctx: DetectorContext): Task | null {
  // Skip if already has weapon
  if (ctx.hasWeapon || ctx.equippedWeapon !== WeaponId.UNARMED) return null;

  // Need a crafting zone
  if (!ctx.craftZoneId) return null;

  const role = (ctx.roleType ?? "").toLowerCase();
  const needsWeaponForRole =
    role === RoleType.HUNTER ||
    role === RoleType.GUARD ||
    role === SocialStatus.WARRIOR;

  // If backend has canCraft info, use it; otherwise assume crafting is possible
  // This allows the handler to verify actual materials availability
  const canCraftAnything =
    ctx.canCraftClub ||
    ctx.canCraftDagger ||
    // Backend fallback: assume crafting possible if work hours and has role that needs weapons
    (ctx.isWorkHours && needsWeaponForRole);

  if (!canCraftAnything) return null;

  const weaponToCraft = ctx.canCraftDagger
    ? "stone_dagger"
    : WeaponId.WOODEN_CLUB;

  return createTask({
    agentId: ctx.agentId,
    type: TaskType.CRAFT,
    priority: needsWeaponForRole
      ? TASK_PRIORITIES.URGENT
      : TASK_PRIORITIES.NORMAL,
    target: { zoneId: ctx.craftZoneId },
    params: {
      itemType: ItemCategory.WEAPON,
      itemId: weaponToCraft,
      roleNeedsWeapon: needsWeaponForRole,
    },
    source: "detector:craft:weapon",
  });
}
