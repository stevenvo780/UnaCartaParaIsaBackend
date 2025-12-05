/**
 * AI type enumerations for the simulation system.
 *
 * Defines all AI-related types including goal types, action types, need types,
 * and personality traits used by the AI system.
 *
 * @module shared/constants/AIEnums
 */

/**
 * Re-export SocialPreference from AgentEnums for backward compatibility.
 * @deprecated Import SocialPreference from AgentEnums instead.
 */
export { SocialPreference } from "./AgentEnums";

/**
 * Re-export WorkEthic from AgentEnums for backward compatibility.
 * @deprecated Import WorkEthic from AgentEnums instead.
 */
export { WorkEthic } from "./AgentEnums";

/**
 * Enumeration of AI goal types.
 * Goals represent high-level objectives that agents work towards.
 */
export enum GoalType {
  SATISFY_NEED = "satisfy_need",
  SATISFY_HUNGER = "satisfy_hunger",
  SATISFY_THIRST = "satisfy_thirst",
  SATISFY_ENERGY = "satisfy_energy",
  SATISFY_SOCIAL = "satisfy_social",
  SATISFY_FUN = "satisfy_fun",
  WORK = "work",
  EXPLORE = "explore",
  SOCIAL = "social",
  COMBAT = "combat",
  CRAFT = "craft",
  DEPOSIT = "deposit",
  ASSIST = "assist",
  CONSTRUCTION = "construction",
  GATHER = "gather",
  IDLE = "idle",
  REST = "rest",
  INSPECT = "inspect",
  FLEE = "flee",
  ATTACK = "attack",
  HUNT = "hunt",
}

/**
 * Enumeration of AI action types.
 * Actions represent specific behaviors that agents perform.
 */
export enum ActionType {
  MOVE = "move",
  HARVEST = "harvest",
  EAT = "eat",
  DRINK = "drink",
  SLEEP = "sleep",
  WORK = "work",
  SOCIALIZE = "socialize",
  ATTACK = "attack",
  CRAFT = "craft",
  DEPOSIT = "deposit",
  BUILD = "build",
  IDLE = "idle",
  BIRTH = "birth",
  DEATH = "death",
  CONTRIBUTE_RESOURCES = "contribute_resources",
  START_QUEST = "start_quest",
}

/**
 * Enumeration of need types that agents must satisfy.
 */
export enum NeedType {
  HUNGER = "hunger",
  THIRST = "thirst",
  ENERGY = "energy",
  SOCIAL = "social",
  FUN = "fun",
  MENTAL_HEALTH = "mentalHealth",
  HYGIENE = "hygiene",
  COMFORT = "comfort",
  SAFETY = "safety",
  RECREATION = "recreation",
}

/**
 * Enumeration of goal domains.
 * Goal domains categorize goals into different priority categories
 * for the AI priority management system.
 */
export enum GoalDomain {
  SURVIVAL = "survival",
  WORK = "work",
  SOCIAL = "social",
  CRAFTING = "crafting",
  COMBAT = "combat",
  FLEE = "flee",
  EXPLORE = "explore",
  LOGISTICS = "logistics",
  REST = "rest",
  INSPECT = "inspect",
}

/**
 * Enumeration of agent priority levels.
 * Determines how agents prioritize their goals and actions.
 */
export enum AgentPriority {
  SURVIVAL = "survival",
  NORMAL = "normal",
  SOCIAL = "social",
  WORK = "work",
  COMBAT = "combat",
  FLEE = "flee",
  IDLE = "idle",
}

/**
 * Enumeration of reasons for goals or actions.
 */
export enum GoalReason {
  REPRODUCTION_DRIVE = "reproduction_drive",
}

/**
 * Type representing all possible goal type values.
 */
export type GoalTypeValue = `${GoalType}`;

/**
 * Type representing all possible action type values.
 */
export type ActionTypeValue = `${ActionType}`;

/**
 * Type representing all possible need type values.
 */
export type NeedTypeValue = `${NeedType}`;

/**
 * Re-export SocialPreferenceValue from AgentEnums for backward compatibility.
 * @deprecated Import from AgentEnums instead.
 */
export type { SocialPreferenceValue } from "./AgentEnums";

/**
 * Re-export WorkEthicValue from AgentEnums for backward compatibility.
 * @deprecated Import from AgentEnums instead.
 */
export type { WorkEthicValue } from "./AgentEnums";

/**
 * Type representing all possible goal domain values.
 */
export type GoalDomainValue = `${GoalDomain}`;

/**
 * Array of all goal types for iteration.
 */
export const ALL_GOAL_TYPES: readonly GoalType[] = Object.values(
  GoalType,
) as GoalType[];

/**
 * Array of all action types for iteration.
 */
export const ALL_ACTION_TYPES: readonly ActionType[] = Object.values(
  ActionType,
) as ActionType[];

/**
 * Array of all need types for iteration.
 */
export const ALL_NEED_TYPES: readonly NeedType[] = Object.values(
  NeedType,
) as NeedType[];

/**
 * Type guard to check if a string is a valid GoalType.
 */
export function isGoalType(value: string): value is GoalType {
  return Object.values(GoalType).includes(value as GoalType);
}

/**
 * Type guard to check if a string is a valid ActionType.
 */
export function isActionType(value: string): value is ActionType {
  return Object.values(ActionType).includes(value as ActionType);
}

/**
 * Type guard to check if a string is a valid NeedType.
 */
export function isNeedType(value: string): value is NeedType {
  return Object.values(NeedType).includes(value as NeedType);
}

/**
 * Array of all goal domains for iteration.
 */
export const ALL_GOAL_DOMAINS: readonly GoalDomain[] = Object.values(
  GoalDomain,
) as GoalDomain[];

/**
 * Type guard to check if a string is a valid GoalDomain.
 */
export function isGoalDomain(value: string): value is GoalDomain {
  return Object.values(GoalDomain).includes(value as GoalDomain);
}

/**
 * Type representing all possible agent priority values.
 */
export type AgentPriorityValue = `${AgentPriority}`;

/**
 * Array of all agent priorities for iteration.
 */
export const ALL_AGENT_PRIORITIES: readonly AgentPriority[] = Object.values(
  AgentPriority,
) as AgentPriority[];

/**
 * Type guard to check if a string is a valid AgentPriority.
 */
export function isAgentPriority(value: string): value is AgentPriority {
  return Object.values(AgentPriority).includes(value as AgentPriority);
}
