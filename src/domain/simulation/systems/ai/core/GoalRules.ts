/**
 * GoalRules - Reglas declarativas que reemplazan los 18 evaluadores
 *
 * Cada regla corresponde a uno o más de los evaluadores originales.
 * Agrupadas por categoría para facilitar mantenimiento.
 */

import {
  GoalType,
  NeedType,
  SearchType,
} from "../../../../../shared/constants/AIEnums";
import {
  ExplorationType,
  WorkEthic,
} from "../../../../../shared/constants/AgentEnums";
import { RoleType } from "../../../../../shared/constants/RoleEnums";
import type { GoalRule } from "./GoalRule";
import { needUtility, socialNeedUtility } from "./GoalRule";





export const hungerRule: GoalRule = {
  id: "bio_hunger",
  goalType: GoalType.SATISFY_HUNGER,
  category: "biological",
  condition: (ctx) => {
    const utility = needUtility(ctx.needs?.hunger);
    return utility > 0;
  },
  priority: (ctx) => {
    const utility = needUtility(ctx.needs?.hunger);

    if ((ctx.needs?.hunger ?? 100) < 15) return 0.95;
    return Math.min(0.9, utility * 0.85);
  },
  minPriority: 0.1,
  isCritical: true,
  getData: (_ctx) => ({
    data: {
      need: NeedType.HUNGER,
      searchType: SearchType.FOOD_OR_PREY,
    },
  }),
};

export const thirstRule: GoalRule = {
  id: "bio_thirst",
  goalType: GoalType.SATISFY_THIRST,
  category: "biological",
  condition: (ctx) => {
    const utility = needUtility(ctx.needs?.thirst);
    return utility > 0;
  },
  priority: (ctx) => {
    const utility = needUtility(ctx.needs?.thirst);

    if ((ctx.needs?.thirst ?? 100) < 15) return 0.98;
    return Math.min(0.92, utility * 0.9);
  },
  minPriority: 0.1,
  isCritical: true,
  getData: (_ctx) => ({
    data: {
      need: NeedType.THIRST,
      searchType: SearchType.WANDER,
    },
  }),
};

export const energyRule: GoalRule = {
  id: "bio_energy",
  goalType: GoalType.REST,
  category: "biological",
  condition: (ctx) => {
    const utility = needUtility(ctx.needs?.energy);
    return utility > 0;
  },
  priority: (ctx) => {
    const utility = needUtility(ctx.needs?.energy);
    if ((ctx.needs?.energy ?? 100) < 10) return 0.85;
    return Math.min(0.8, utility * 0.75);
  },
  minPriority: 0.15,
  getData: (_ctx) => ({
    data: {
      need: NeedType.ENERGY,
      action: "rest",
    },
  }),
};





export const socialRule: GoalRule = {
  id: "social_interact",
  goalType: GoalType.SATISFY_SOCIAL,
  category: "social",
  condition: (ctx) => socialNeedUtility(ctx.needs?.social) > 0,
  priority: (ctx) => socialNeedUtility(ctx.needs?.social) * 0.8,
  minPriority: 0.2,
  getData: () => ({
    data: {
      need: NeedType.SOCIAL,
      action: "socialize",
    },
  }),
};

export const funRule: GoalRule = {
  id: "social_fun",
  goalType: GoalType.SATISFY_FUN,
  category: "social",
  condition: (ctx) => socialNeedUtility(ctx.needs?.fun) > 0,
  priority: (ctx) => socialNeedUtility(ctx.needs?.fun) * 0.7,
  minPriority: 0.15,
  getData: () => ({
    data: {
      need: NeedType.FUN,
      action: "play",
    },
  }),
};

export const mentalHealthRule: GoalRule = {
  id: "social_mental",
  goalType: GoalType.SATISFY_SOCIAL,
  category: "social",
  condition: (ctx) => socialNeedUtility(ctx.needs?.mentalHealth) > 0,
  priority: (ctx) => socialNeedUtility(ctx.needs?.mentalHealth) * 0.9,
  minPriority: 0.25,
  getData: () => ({
    data: {
      need: NeedType.MENTAL_HEALTH,
      action: "meditate",
    },
  }),
};





export const workDriveRule: GoalRule = {
  id: "cognitive_work",
  goalType: GoalType.WORK,
  category: "cognitive",
  condition: (ctx) => {

    const hasRole = ctx.roleType && ctx.roleType !== RoleType.IDLE;
    const highDiligence = ctx.aiState.personality.diligence > 0.6;
    return hasRole || highDiligence;
  },
  priority: (ctx) => {
    let base = 0.3;


    if (ctx.aiState.personality.workEthic === WorkEthic.WORKAHOLIC) base += 0.3;
    if (ctx.aiState.personality.workEthic === WorkEthic.LAZY) base -= 0.2;


    if (ctx.roleType && ctx.roleType !== RoleType.IDLE) base += 0.2;


    base += ctx.aiState.personality.diligence * 0.2;

    return Math.max(0, Math.min(1, base));
  },
  minPriority: 0.5,
};

export const exploreDriveRule: GoalRule = {
  id: "cognitive_explore",
  goalType: GoalType.EXPLORE,
  category: "exploration",
  condition: (ctx) => {
    const lastExplore = ctx.aiState.memory.lastExplorationTime ?? 0;
    const timeSinceExplore = ctx.now - lastExplore;

    return (
      timeSinceExplore > 60000 ||
      ctx.aiState.personality.explorationType === ExplorationType.ADVENTUROUS
    );
  },
  priority: (ctx) => {

    let base = 0.15;

    if (
      ctx.aiState.personality.explorationType === ExplorationType.ADVENTUROUS
    ) {
      base += 0.15;
    }
    if (ctx.aiState.personality.explorationType === ExplorationType.CAUTIOUS) {
      base -= 0.05;
    }

    const lastExplore = ctx.aiState.memory.lastExplorationTime ?? 0;
    const timeSinceExplore = ctx.now - lastExplore;
    if (timeSinceExplore > 60000) base += 0.1;
    if (timeSinceExplore > 300000) base += 0.2;


    base += ctx.aiState.personality.curiosity * 0.1;


    return Math.max(0, Math.min(0.55, base));
  },
  minPriority: 0.2,
  getData: () => ({
    data: {
      explorationType: "curiosity",
      reason: "cognitive_drive",
    },
  }),
};





export const defaultExplorationRule: GoalRule = {
  id: "default_explore",
  goalType: GoalType.EXPLORE,
  category: "exploration",

  condition: () => true,
  priority: (ctx) => 0.15 + ctx.aiState.personality.curiosity * 0.05,
  minPriority: 0.1,
  getData: () => ({
    data: {
      explorationType: "default",
      reason: "no_other_goals",
    },
  }),
};





/**
 * Calcula el drive de reproducción basado en bienestar general.
 * Solo activo cuando el agente está sano, alimentado y descansado.
 */
function calculateReproductionDrive(
  needs: { hunger?: number; thirst?: number; energy?: number },
  stats: Record<string, number> | null,
): number {
  const health = stats?.health ?? 100;
  const energy = needs.energy ?? 100;
  const hunger = needs.hunger ?? 100;
  const thirst = needs.thirst ?? 100;

  const wHealth = 0.3;
  const wEnergy = 0.3;
  const wFood = 0.2;
  const wWater = 0.2;

  const drive =
    (health / 100) * wHealth +
    (energy / 100) * wEnergy +
    (hunger / 100) * wFood +
    (thirst / 100) * wWater;

  if (drive < 0.8) return 0;
  return (drive - 0.8) * 5;
}

export const reproductionRule: GoalRule = {
  id: "reproduction",
  goalType: GoalType.SOCIAL,
  category: "social",
  condition: (ctx) => {
    if (!ctx.needs) return false;
    const drive = calculateReproductionDrive(ctx.needs, ctx.stats ?? null);
    return drive > 0;
  },
  priority: (ctx) => {
    const drive = calculateReproductionDrive(ctx.needs!, ctx.stats ?? null);

    const hasMate = ctx.findPotentialMate?.(ctx.entityId);
    return hasMate ? drive : drive * 0.8;
  },
  minPriority: 0.3,
  getData: (ctx) => {
    const mate = ctx.findPotentialMate?.(ctx.entityId);
    if (mate) {
      return {
        targetId: mate.id,
        targetPosition: { x: mate.x, y: mate.y },
        data: {
          action: "find_mate",
          reason: "reproduction_drive",
        },
      };
    }
    return {
      data: {
        explorationType: "social_search",
        searchFor: "mate",
        reason: "reproduction_drive",
      },
    };
  },
};





const DEFAULT_INVENTORY_CAPACITY = 50;
const GATHER_TRIGGER_THRESHOLD = 0.8;

export const gatherExpansionRule: GoalRule = {
  id: "gather_expansion",
  goalType: GoalType.EXPLORE,
  category: "work",
  condition: (ctx) => {
    if (!ctx.inventory) return false;
    const totalItems =
      (ctx.inventory.wood || 0) +
      (ctx.inventory.stone || 0) +
      (ctx.inventory.food || 0);
    return totalItems < DEFAULT_INVENTORY_CAPACITY * GATHER_TRIGGER_THRESHOLD;
  },
  priority: (ctx) => 0.35 + ctx.aiState.personality.diligence * 0.2,
  minPriority: 0.3,
  getData: () => ({
    data: {
      explorationType: "resource_scout",
      targetResource: "wood",
    },
  }),
};

export const territoryExpansionRule: GoalRule = {
  id: "territory_expansion",
  goalType: GoalType.EXPLORE,
  category: "exploration",
  condition: (ctx) => ctx.position !== undefined,
  priority: (ctx) => 0.3 + ctx.aiState.personality.curiosity * 0.3,
  minPriority: 0.25,
  getData: (ctx) => {
    const mapWidth = ctx.gameState?.worldSize?.width || 2000;
    const mapHeight = ctx.gameState?.worldSize?.height || 2000;
    return {
      data: {
        explorationType: "territory_expansion",
        targetRegionX: Math.random() * mapWidth,
        targetRegionY: Math.random() * mapHeight,
      },
    };
  },
};





const FLEE_COOLDOWN_MS = 5000;
const fleeCooldowns: Map<string, number> = new Map();

function canFlee(entityId: string, now: number): boolean {
  const lastFlee = fleeCooldowns.get(entityId);
  if (!lastFlee) return true;
  return now - lastFlee >= FLEE_COOLDOWN_MS;
}

export const fleeFromEnemyRule: GoalRule = {
  id: "flee_enemy",
  goalType: GoalType.FLEE,
  category: "combat",
  condition: (ctx) => {
    if (!ctx.enemies || ctx.enemies.length === 0) return false;
    if (!ctx.position) return false;
    if (ctx.isWarrior) return false;
    return canFlee(ctx.entityId, ctx.now);
  },
  priority: (ctx) => {
    const stats = ctx.stats ?? {};
    const morale = stats.morale ?? 60;
    const neuroticism = ctx.aiState.personality.neuroticism ?? 0.5;
    const panicThreshold = 40 + neuroticism * 20;
    return morale < panicThreshold ? 0.95 : 0.85;
  },
  minPriority: 0.8,
  isCritical: true,
  getData: (ctx) => {

    const myPos = ctx.position!;
    const nearestEnemy = ctx.enemies![0];
    const enemyPos = ctx.getEntityPosition?.(nearestEnemy);

    if (!enemyPos) {
      return { data: { reason: "enemy_nearby" } };
    }

    const dx = myPos.x - enemyPos.x;
    const dy = myPos.y - enemyPos.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const scale = 140 / len;

    fleeCooldowns.set(ctx.entityId, ctx.now);

    return {
      targetPosition: {
        x: myPos.x + dx * scale,
        y: myPos.y + dy * scale,
      },
      data: { reason: "enemy_too_close", threatPos: enemyPos },
    };
  },
};

export const fleeFromPredatorRule: GoalRule = {
  id: "flee_predator",
  goalType: GoalType.FLEE,
  category: "combat",
  condition: (ctx) => {
    if (!ctx.nearbyPredators || ctx.nearbyPredators.length === 0) return false;
    if (!ctx.position) return false;


    const closest = ctx.nearbyPredators[0];
    const dist = Math.hypot(
      closest.position.x - ctx.position.x,
      closest.position.y - ctx.position.y,
    );


    if (ctx.isWarrior) return false;

    return dist < 80 && canFlee(ctx.entityId, ctx.now);
  },
  priority: (ctx) => {
    const closest = ctx.nearbyPredators![0];
    const dist = Math.hypot(
      closest.position.x - ctx.position!.x,
      closest.position.y - ctx.position!.y,
    );

    return Math.min(0.9, 0.7 + (80 - dist) / 300);
  },
  minPriority: 0.7,
  isCritical: true,
  getData: (ctx) => {
    const myPos = ctx.position!;
    const predator = ctx.nearbyPredators![0];

    const dx = myPos.x - predator.position.x;
    const dy = myPos.y - predator.position.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const scale = 150 / len;

    fleeCooldowns.set(ctx.entityId, ctx.now);

    return {
      targetPosition: {
        x: myPos.x + dx * scale,
        y: myPos.y + dy * scale,
      },
      data: { reason: "predator_panic", threatPos: predator.position },
    };
  },
};

export const attackPredatorRule: GoalRule = {
  id: "attack_predator",
  goalType: GoalType.ATTACK,
  category: "combat",
  condition: (ctx) => {
    if (!ctx.nearbyPredators || ctx.nearbyPredators.length === 0) return false;
    if (!ctx.position) return false;


    const stats = ctx.stats ?? {};
    const morale = stats.morale ?? 50;
    const health = stats.health ?? 100;
    const fightThreshold = 60 + ctx.aiState.personality.neuroticism * 20;

    return ctx.isWarrior || (morale > fightThreshold && health > 50);
  },
  priority: () => 0.95,
  minPriority: 0.9,
  isCritical: true,
  getData: (ctx) => {
    const predator = ctx.nearbyPredators![0];
    return {
      targetId: predator.id,
      targetPosition: predator.position,
      data: { reason: "predator_defense" },
    };
  },
};





export const constructionRule: GoalRule = {
  id: "construction",
  goalType: GoalType.CONSTRUCTION,
  category: "work",
  condition: (ctx) => {

    if (!ctx.buildTasks || ctx.buildTasks.length === 0) return false;
    if (!ctx.position) return false;
    return true;
  },
  priority: (ctx) => {
    const dutyFactor = ctx.aiState.personality.conscientiousness ?? 0.5;
    const communityFactor = ctx.aiState.personality.agreeableness ?? 0.5;
    return Math.min(0.9, 0.3 + dutyFactor * 0.4 + communityFactor * 0.2);
  },
  minPriority: 0.35,
  getData: (ctx) => {
    const best = ctx.buildTasks![0];
    return {
      targetZoneId: best.zoneId,
      data: {
        taskId: best.id,
        workType: "construction",
      },
    };
  },
};





export const depositRule: GoalRule = {
  id: "deposit",
  goalType: GoalType.DEPOSIT,
  category: "work",
  condition: (ctx) => {
    if (!ctx.inventoryLoad || ctx.inventoryLoad <= 0) return false;
    if (!ctx.depositZoneId) return false;

    const cap = ctx.inventoryCapacity ?? 50;
    const loadRatio = ctx.inventoryLoad / cap;

    return loadRatio >= 0.1;
  },
  priority: (ctx) => {
    const cap = ctx.inventoryCapacity ?? 50;
    const loadRatio = ctx.inventoryLoad! / cap;
    const conscientiousness = ctx.aiState.personality.conscientiousness ?? 0.5;





    let priority = 0.5 + loadRatio * 0.5;


    priority += conscientiousness * 0.1;


    if (ctx.hasWater || ctx.hasFood) {
      priority += 0.15;
    }

    return Math.min(0.95, priority);
  },
  minPriority: 0.5,
  getData: (ctx) => ({
    targetZoneId: ctx.depositZoneId,
    data: {
      workType: "deposit",
      hasWater: ctx.hasWater ?? false,
      hasFood: ctx.hasFood ?? false,
    },
  }),
};





export const craftWeaponRule: GoalRule = {
  id: "craft_weapon",
  goalType: GoalType.CRAFT,
  category: "work",
  condition: (ctx) => {

    const equipped = ctx.equippedWeapon ?? "unarmed";
    if (equipped !== "unarmed") return false;


    if (ctx.hasAvailableWeapons) return false;


    if (!ctx.canCraftClub && !ctx.canCraftDagger) return false;


    if (!ctx.craftZoneId) return false;

    return true;
  },
  priority: (ctx) => {

    const role = (ctx.roleType ?? "").toLowerCase();
    const needsWeaponForJob =
      role === "hunter" || role === "guard" || role === "warrior";


    return needsWeaponForJob ? 0.92 : 0.72;
  },
  minPriority: 0.7,
  getData: (ctx) => {
    const weaponToCraft = ctx.canCraftDagger ? "stone_dagger" : "wooden_club";
    const role = (ctx.roleType ?? "").toLowerCase();
    const needsWeaponForJob =
      role === "hunter" || role === "guard" || role === "warrior";

    return {
      targetZoneId: ctx.craftZoneId,
      data: {
        itemType: "weapon",
        itemId: weaponToCraft,
        roleNeedsWeapon: needsWeaponForJob,
      },
    };
  },
};





export const assistRule: GoalRule = {
  id: "assist",
  goalType: GoalType.ASSIST,
  category: "social",
  condition: (ctx) => {
    if (!ctx.nearbyAgentInNeed) return false;
    if (!ctx.nearbyAgentInNeed.targetZoneId) return false;
    return true;
  },
  priority: (ctx) => {
    const agreeableness = ctx.aiState.personality.agreeableness ?? 0.5;
    return 0.4 + agreeableness * 0.4;
  },
  minPriority: 0.4,
  getData: (ctx) => ({
    targetZoneId: ctx.nearbyAgentInNeed!.targetZoneId,
    data: {
      targetAgentId: ctx.nearbyAgentInNeed!.id,
      need: ctx.nearbyAgentInNeed!.need as unknown as NeedType,
      amount: 10,
    },
  }),
};





export const tradeRule: GoalRule = {
  id: "trade",
  goalType: GoalType.WORK,
  category: "work",
  condition: (ctx) => {
    if (!ctx.hasExcessResources) return false;
    if (!ctx.nearestMarketZoneId) return false;
    return true;
  },
  priority: (_ctx) => 0.4,
  minPriority: 0.35,
  getData: (ctx) => ({
    targetZoneId: ctx.nearestMarketZoneId,
    data: { action: "trade" },
  }),
};





export const roleWorkRule: GoalRule = {
  id: "role_work",
  goalType: GoalType.WORK,
  category: "work",
  condition: (ctx) => {
    if (!ctx.roleType) return false;


    return true;
  },
  priority: (ctx) => {
    const diligence = ctx.aiState.personality.diligence ?? 0.5;
    const efficiency = ctx.roleEfficiency ?? 1.0;
    const hasTarget = ctx.nearestPreferredResource ? 0.1 : 0;
    return 0.6 * diligence * efficiency + hasTarget;
  },
  minPriority: 0.3,
  getData: (ctx) => {
    if (ctx.nearestPreferredResource) {
      return {
        targetId: ctx.nearestPreferredResource.id,
        targetPosition: {
          x: ctx.nearestPreferredResource.x,
          y: ctx.nearestPreferredResource.y,
        },
        data: {
          roleType: ctx.roleType,
        },
      };
    }
    return {
      data: { roleType: ctx.roleType },
    };
  },
};

export const huntingRule: GoalRule = {
  id: "hunting",
  goalType: GoalType.HUNT,
  category: "work",
  condition: (ctx) => {
    const role = (ctx.roleType ?? "").toLowerCase();
    return role === "hunter";
  },
  priority: (ctx) => {
    const diligence = ctx.aiState.personality.diligence ?? 0.5;
    const efficiency = ctx.roleEfficiency ?? 1.0;
    return 0.7 * diligence * efficiency;
  },
  minPriority: 0.4,
  getData: (_ctx) => ({
    data: { targetType: "prey" },
  }),
};





export const inspectionRule: GoalRule = {
  id: "inspection",
  goalType: GoalType.EXPLORE,
  category: "exploration",
  condition: (ctx) => {
    if (!ctx.nearbyInspectable) return false;
    return true;
  },
  priority: (ctx) => {
    const openness = ctx.aiState.personality.openness ?? 0.5;
    return 0.5 * (0.7 + openness * 0.6);
  },
  minPriority: 0.3,
  getData: (ctx) => ({
    targetId: ctx.nearbyInspectable!.id,
    targetPosition: ctx.nearbyInspectable!.position,
    data: { explorationType: "inspect" },
  }),
};





export const buildingContributionRule: GoalRule = {
  id: "building_contribution",
  goalType: GoalType.WORK,
  category: "work",
  condition: (ctx) => {
    if (!ctx.contributableBuilding) return false;

    const hasResources =
      (ctx.inventory?.wood ?? 0) > 5 || (ctx.inventory?.stone ?? 0) > 5;
    return hasResources;
  },
  priority: (_ctx) => 0.5,
  minPriority: 0.4,
  getData: (ctx) => ({
    targetZoneId: ctx.contributableBuilding!.zoneId,
    data: { action: "contribute_resources" },
  }),
};





export const questRule: GoalRule = {
  id: "quest",
  goalType: GoalType.WORK,
  category: "work",
  condition: (ctx) => {
    if (!ctx.activeQuestGoal) return false;
    return true;
  },
  priority: (_ctx) => 0.6,
  minPriority: 0.5,
  getData: (ctx) => {
    const quest = ctx.activeQuestGoal!;

    let goalType = GoalType.WORK;
    if (quest.goalType === "gather") goalType = GoalType.GATHER;
    if (quest.goalType === "explore") goalType = GoalType.EXPLORE;
    if (quest.goalType === "combat") goalType = GoalType.COMBAT;

    return {
      type: goalType,
      targetZoneId: quest.targetZoneId,
      data: {
        questId: quest.questId,
        objectiveId: quest.objectiveId,
      },
    };
  },
};





/**
 * Reglas core que reemplazan:
 * - BiologicalDriveEvaluator
 * - SocialDriveEvaluator
 * - CognitiveDriveEvaluator
 * - AttentionEvaluator (parcialmente)
 */
export const coreRules: GoalRule[] = [

  thirstRule,
  hungerRule,
  energyRule,

  mentalHealthRule,
  socialRule,
  funRule,

  workDriveRule,
  exploreDriveRule,

  defaultExplorationRule,
];

/**
 * Reglas extendidas que incluyen combat y expansion.
 * Usar cuando el contexto tiene datos de combat/enemies.
 */
export const extendedRules: GoalRule[] = [

  fleeFromEnemyRule,
  fleeFromPredatorRule,
  attackPredatorRule,

  ...coreRules,

  gatherExpansionRule,
  territoryExpansionRule,

  reproductionRule,
];

/**
 * Todas las reglas disponibles, incluyendo work (construcción, depósito, crafting).
 * Usar para agentes que necesitan el sistema completo.
 */
export const fullRules: GoalRule[] = [

  fleeFromEnemyRule,
  fleeFromPredatorRule,
  attackPredatorRule,

  craftWeaponRule,

  ...coreRules,

  assistRule,

  constructionRule,
  depositRule,
  roleWorkRule,
  huntingRule,
  buildingContributionRule,
  tradeRule,

  questRule,

  gatherExpansionRule,
  territoryExpansionRule,

  inspectionRule,

  reproductionRule,
];
