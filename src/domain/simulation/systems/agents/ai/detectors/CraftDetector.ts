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
import { RoleType } from '../../../../../../shared/constants/RoleEnums';
import { SocialStatus } from '../../../../../../shared/constants/AgentEnums';
import { ItemCategory } from '../../../../../../shared/constants/ItemEnums';

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
  if (ctx.hasWeapon || ctx.equippedWeapon !== "unarmed") return null;

  if (!ctx.canCraftClub && !ctx.canCraftDagger) return null;

  if (!ctx.craftZoneId) return null;

  const role = (ctx.roleType ?? "").toLowerCase();
  const needsWeaponForRole =
    role === RoleType.HUNTER || role === RoleType.GUARD || role === SocialStatus.WARRIOR;

  const weaponToCraft = ctx.canCraftDagger ? "stone_dagger" : "wooden_club";

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
