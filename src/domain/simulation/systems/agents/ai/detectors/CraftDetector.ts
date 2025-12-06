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
  if (ctx.hasWeapon || ctx.equippedWeapon !== WeaponId.UNARMED) return null;

  // Primitive weapons (wooden_club, stone_dagger) can be crafted anywhere
  // Advanced weapons require a craft zone
  const isPrimitiveWeapon = ctx.canCraftClub || ctx.canCraftDagger;
  const needsCraftZone = !isPrimitiveWeapon;

  if (needsCraftZone && !ctx.craftZoneId) return null;

  const role = (ctx.roleType ?? "").toLowerCase();
  const needsWeaponForRole =
    role === RoleType.HUNTER ||
    role === RoleType.GUARD ||
    role === SocialStatus.WARRIOR;

  const canCraftAnything =
    ctx.canCraftClub ||
    ctx.canCraftDagger ||
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
    // For primitive weapons, target is optional (can craft anywhere)
    target: ctx.craftZoneId ? { zoneId: ctx.craftZoneId } : undefined,
    params: {
      itemType: ItemCategory.WEAPON,
      itemId: weaponToCraft,
      roleNeedsWeapon: needsWeaponForRole,
    },
    source: "detector:craft:weapon",
  });
}
