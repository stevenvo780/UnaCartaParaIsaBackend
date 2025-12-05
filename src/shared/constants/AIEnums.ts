/**
 * AI type enumerations for the simulation system.
 *
 * Defines all AI-related types including goal types, action types, need types,
 * and personality traits used by the AI system.
 *
 * @module shared/constants/AIEnums
 */

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

// Se eliminaron alias y type guards sin consumidores para reducir ruido.
