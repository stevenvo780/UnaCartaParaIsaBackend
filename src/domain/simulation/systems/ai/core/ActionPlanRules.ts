/**
 * ActionPlanRules.ts
 *
 * Declarative mapping of GoalType → ActionType with range/zone logic.
 * Replaces 20+ planXXX methods with ~5 generic handlers.
 */

import { ActionType, GoalType } from "../../../../../shared/constants/AIEnums";
import { ZoneType } from "../../../../../shared/constants/ZoneEnums";

/**
 * Range-based action: if within range → execute action, else MOVE toward target
 */
export interface RangeAction {
  type: "range";
  executeAction: ActionType; // Action when within range
  range: number;
}

/**
 * Zone-based action: if inside zone → execute action, else MOVE to zone
 */
export interface ZoneAction {
  type: "zone";
  executeAction: ActionType;
  zoneTypes?: ZoneType[]; // Fallback zone types if goal has no targetZoneId
}

/**
 * Simple action: just return this action directly
 */
export interface SimpleAction {
  type: "simple";
  action: ActionType;
}

/**
 * Move action: always returns MOVE to target
 */
export interface MoveAction {
  type: "move";
}

export type ActionPlanRule =
  | RangeAction
  | ZoneAction
  | SimpleAction
  | MoveAction;

/**
 * Declarative mapping: GoalType → how to convert to AgentAction
 */
export const ACTION_PLAN_RULES: Partial<Record<GoalType, ActionPlanRule>> = {
  // === RANGE-BASED (harvest/attack if within range) ===
  [GoalType.SATISFY_HUNGER]: {
    type: "range",
    executeAction: ActionType.HARVEST,
    range: 250,
  },
  [GoalType.SATISFY_THIRST]: {
    type: "range",
    executeAction: ActionType.HARVEST,
    range: 250,
  },
  [GoalType.SATISFY_NEED]: {
    type: "range",
    executeAction: ActionType.HARVEST,
    range: 250,
  },
  [GoalType.GATHER]: {
    type: "range",
    executeAction: ActionType.HARVEST,
    range: 250,
  },
  [GoalType.ATTACK]: {
    type: "range",
    executeAction: ActionType.ATTACK,
    range: 50,
  },
  [GoalType.COMBAT]: {
    type: "range",
    executeAction: ActionType.ATTACK,
    range: 50,
  },
  [GoalType.HUNT]: {
    type: "range",
    executeAction: ActionType.ATTACK,
    range: 50,
  },

  // === ZONE-BASED (enter zone, then execute action) ===
  [GoalType.SATISFY_ENERGY]: {
    type: "zone",
    executeAction: ActionType.SLEEP,
    zoneTypes: [ZoneType.REST, ZoneType.BEDROOM, ZoneType.SHELTER],
  },
  [GoalType.SATISFY_SOCIAL]: {
    type: "zone",
    executeAction: ActionType.SOCIALIZE,
    zoneTypes: [
      ZoneType.SOCIAL,
      ZoneType.GATHERING,
      ZoneType.MARKET,
      ZoneType.TAVERN,
    ],
  },
  [GoalType.SOCIAL]: {
    type: "zone",
    executeAction: ActionType.SOCIALIZE,
    zoneTypes: [
      ZoneType.SOCIAL,
      ZoneType.GATHERING,
      ZoneType.MARKET,
      ZoneType.TEMPLE,
      ZoneType.SANCTUARY,
    ],
  },
  [GoalType.SATISFY_FUN]: {
    type: "zone",
    executeAction: ActionType.SOCIALIZE,
    zoneTypes: [
      ZoneType.ENTERTAINMENT,
      ZoneType.TAVERN,
      ZoneType.MARKET,
      ZoneType.GATHERING,
    ],
  },
  [GoalType.CRAFT]: {
    type: "zone",
    executeAction: ActionType.CRAFT,
    zoneTypes: [ZoneType.WORK],
  },
  [GoalType.DEPOSIT]: {
    type: "zone",
    executeAction: ActionType.DEPOSIT,
    zoneTypes: [ZoneType.STORAGE, ZoneType.WORK],
  },
  [GoalType.WORK]: {
    type: "zone",
    executeAction: ActionType.WORK,
    zoneTypes: [ZoneType.WORK],
  },
  [GoalType.CONSTRUCTION]: {
    type: "zone",
    executeAction: ActionType.WORK,
    zoneTypes: [ZoneType.WORK],
  },
  [GoalType.ASSIST]: {
    type: "zone",
    executeAction: ActionType.SOCIALIZE,
    zoneTypes: [ZoneType.SOCIAL],
  },

  // === SIMPLE (just return this action) ===
  [GoalType.IDLE]: {
    type: "simple",
    action: ActionType.IDLE,
  },
  [GoalType.REST]: {
    type: "simple",
    action: ActionType.IDLE,
  },

  // === MOVE-ONLY ===
  [GoalType.FLEE]: {
    type: "move",
  },
  [GoalType.EXPLORE]: {
    type: "move",
  },
  [GoalType.INSPECT]: {
    type: "move",
  },
};

/** Range thresholds */
export const HARVEST_RANGE = 250;
export const ATTACK_RANGE = 50;
export const EXPLORE_RANGE = 200;

/**
 * Resource type → world object types to search for.
 * Used by planWork to find the right resource.
 */
export const RESOURCE_SEARCH_MAP: Record<string, string[]> = {
  food: ["berry_bush", "mushroom_patch", "wheat_crop"],
  water: ["water_source"],
  wood: ["tree"],
  stone: ["rock"],
  metal: ["rock"],
  iron_ore: ["rock"],
  copper_ore: ["rock"],
};

/**
 * TaskType → resource search types
 */
export const TASK_SEARCH_MAP: Record<string, string[]> = {
  gather_food: ["berry_bush", "mushroom_patch", "wheat_crop"],
  gather_water: ["water_source"],
  gather_wood: ["tree"],
  gather_stone: ["rock"],
  gather_metal: ["rock"],
};
