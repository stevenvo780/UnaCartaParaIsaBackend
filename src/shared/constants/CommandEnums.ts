/**
 * Command type enumerations for the simulation system.
 *
 * Defines all command types used in SimulationCommand and related payloads.
 *
 * @module shared/constants/CommandEnums
 */

/**
 * Enumeration of main simulation command types.
 */
export enum SimulationCommandType {
  SET_TIME_SCALE = "SET_TIME_SCALE",
  APPLY_RESOURCE_DELTA = "APPLY_RESOURCE_DELTA",
  GATHER_RESOURCE = "GATHER_RESOURCE",
  GIVE_RESOURCE = "GIVE_RESOURCE",
  SPAWN_AGENT = "SPAWN_AGENT",
  KILL_AGENT = "KILL_AGENT",
  PING = "PING",
  AGENT_COMMAND = "AGENT_COMMAND",
  ANIMAL_COMMAND = "ANIMAL_COMMAND",
  NEEDS_COMMAND = "NEEDS_COMMAND",
  RECIPE_COMMAND = "RECIPE_COMMAND",
  SOCIAL_COMMAND = "SOCIAL_COMMAND",
  RESEARCH_COMMAND = "RESEARCH_COMMAND",
  WORLD_RESOURCE_COMMAND = "WORLD_RESOURCE_COMMAND",
  DIALOGUE_COMMAND = "DIALOGUE_COMMAND",
  BUILDING_COMMAND = "BUILDING_COMMAND",
  REPUTATION_COMMAND = "REPUTATION_COMMAND",
  TASK_COMMAND = "TASK_COMMAND",
  CONFLICT_COMMAND = "CONFLICT_COMMAND",
  TIME_COMMAND = "TIME_COMMAND",
  FORCE_EMERGENCE_EVALUATION = "FORCE_EMERGENCE_EVALUATION",
  SAVE_GAME = "SAVE_GAME",
}

/**
 * Enumeration of needs command types.
 */
export enum NeedsCommandType {
  SATISFY_NEED = "SATISFY_NEED",
  MODIFY_NEED = "MODIFY_NEED",
  UPDATE_CONFIG = "UPDATE_CONFIG",
}

/**
 * Enumeration of recipe command types.
 */
export enum RecipeCommandType {
  TEACH_RECIPE = "TEACH_RECIPE",
  SHARE_RECIPE = "SHARE_RECIPE",
}

/**
 * Enumeration of social command types.
 */
export enum SocialCommandType {
  IMPOSE_TRUCE = "IMPOSE_TRUCE",
  SET_AFFINITY = "SET_AFFINITY",
  MODIFY_AFFINITY = "MODIFY_AFFINITY",
  FRIENDLY_INTERACTION = "FRIENDLY_INTERACTION",
  HOSTILE_ENCOUNTER = "HOSTILE_ENCOUNTER",
  REMOVE_RELATIONSHIPS = "REMOVE_RELATIONSHIPS",
}

/**
 * Enumeration of research command types.
 */
export enum ResearchCommandType {
  INITIALIZE_LINEAGE = "INITIALIZE_LINEAGE",
  RECIPE_DISCOVERED = "RECIPE_DISCOVERED",
}

/**
 * Enumeration of world resource command types.
 */
export enum WorldResourceCommandType {
  SPAWN_RESOURCE = "SPAWN_RESOURCE",
  HARVEST_RESOURCE = "HARVEST_RESOURCE",
}

/**
 * Enumeration of dialogue command types.
 */
export enum DialogueCommandType {
  RESPOND_TO_CARD = "RESPOND_TO_CARD",
}

/**
 * Enumeration of building command types.
 */
export enum BuildingCommandType {
  START_UPGRADE = "START_UPGRADE",
  CANCEL_UPGRADE = "CANCEL_UPGRADE",
  ENQUEUE_CONSTRUCTION = "ENQUEUE_CONSTRUCTION",
  CONSTRUCT_BUILDING = "CONSTRUCT_BUILDING",
}

/**
 * Enumeration of reputation command types.
 */
export enum ReputationCommandType {
  UPDATE_TRUST = "UPDATE_TRUST",
}

/**
 * Enumeration of task command types.
 */
export enum TaskCommandType {
  CREATE_TASK = "CREATE_TASK",
  CONTRIBUTE_TO_TASK = "CONTRIBUTE_TO_TASK",
  REMOVE_TASK = "REMOVE_TASK",
}

/**
 * Enumeration of conflict command types.
 */
export enum ConflictCommandType {
  RESOLVE_CONFLICT = "RESOLVE_CONFLICT",
}

/**
 * Enumeration of time command types.
 */
export enum TimeCommandType {
  SET_WEATHER = "SET_WEATHER",
}

/**
 * Enumeration of agent command types.
 * Commands that can be sent to individual agents.
 */
export enum AgentCommandType {
  MOVE_TO = "MOVE_TO",
  STOP_MOVEMENT = "STOP_MOVEMENT",
  SET_PRIORITY = "SET_PRIORITY",
}

/**
 * Enumeration of animal command types.
 * Commands that can be sent to the animal system.
 */
export enum AnimalCommandType {
  SPAWN_ANIMAL = "SPAWN_ANIMAL",
}

/**
 * Enumeration of simulation request types.
 */
export enum SimulationRequestType {
  REQUEST_FULL_STATE = "REQUEST_FULL_STATE",
  REQUEST_ENTITY_DETAILS = "REQUEST_ENTITY_DETAILS",
  REQUEST_PLAYER_ID = "REQUEST_PLAYER_ID",
}
