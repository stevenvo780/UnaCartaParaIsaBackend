import { GameEventType } from "../../../shared/constants/EventEnums";

/**
 * Maps backend event names (UPPER_SNAKE_CASE) to frontend event names (lowercase:colon:format)
 * This ensures compatibility between backend and frontend event systems
 */
export const eventNameMapper: Record<GameEventType, string> = {
  [GameEventType.COMBAT_KILL]: "combat:kill",
  [GameEventType.COMBAT_HIT]: "combat:hit",
  [GameEventType.COMBAT_ENGAGED]: "combat:engaged",
  [GameEventType.COMBAT_WEAPON_EQUIPPED]: "combat:weapon:equipped",
  [GameEventType.COMBAT_WEAPON_CRAFTED]: "combat:weapon:crafted",

  [GameEventType.AGENT_BIRTH]: "agent:birth",
  [GameEventType.AGENT_DEATH]: "agent:death",
  [GameEventType.AGENT_AGED]: "agent:aged",
  [GameEventType.AGENT_RESPAWNED]: "agent:respawned",
  [GameEventType.AGENT_ACTION_COMPLETE]: "agent:action:complete",
  [GameEventType.AGENT_ACTION_COMMANDED]: "agent:action:commanded",
  [GameEventType.AGENT_GOAL_CHANGED]: "agent:goal:changed",

  [GameEventType.BUILDING_CONSTRUCTED]: "building:constructed",
  [GameEventType.BUILDING_DAMAGED]: "building:damaged",
  [GameEventType.BUILDING_REPAIRED]: "building:repaired",
  [GameEventType.BUILDING_CONSTRUCTION_STARTED]:
    "building:construction:started",

  [GameEventType.RESOURCE_GATHERED]: "resource:gathered",
  [GameEventType.RESOURCE_SPAWNED]: "resource:spawned",
  [GameEventType.RESOURCE_DEPLETED]: "resource:depleted",
  [GameEventType.RESOURCE_STATE_CHANGE]: "resource:state:change",
  [GameEventType.RESOURCE_CONSUMED]: "resource:consumed",
  [GameEventType.RESOURCE_DISCOVERED]: "resource:discovered",
  [GameEventType.RESOURCES_DEPOSITED]: "resources:deposited",

  [GameEventType.ANIMAL_SPAWNED]: "animal:spawned",
  [GameEventType.ANIMAL_DIED]: "animal:died",
  [GameEventType.ANIMAL_HUNTED]: "animal:hunted",
  [GameEventType.ANIMAL_CONSUMED_RESOURCE]: "animal:consumed:resource",
  [GameEventType.ANIMAL_REPRODUCED]: "animal:reproduced",

  [GameEventType.SOCIAL_RELATION_CHANGED]: "social:relation:changed",
  [GameEventType.SOCIAL_TRUCE_IMPOSED]: "social:truce:imposed",
  [GameEventType.SOCIAL_TRUCE_EXPIRED]: "social:truce:expired",
  [GameEventType.SOCIAL_RALLY]: "social:rally",
  [GameEventType.SOCIAL_GROUPS_UPDATE]: "social:groups:update",
  [GameEventType.SOCIAL_INTERACTION]: "social:interaction",
  [GameEventType.FRIENDSHIP_FORMED]: "social:friendship:formed",
  [GameEventType.RELATIONSHIP_ENDED]: "social:relationship:ended",

  [GameEventType.MOVEMENT_ARRIVED_AT_ZONE]: "movement:arrived:zone",
  [GameEventType.MOVEMENT_ACTIVITY_COMPLETED]: "movement:activity:completed",
  [GameEventType.MOVEMENT_ACTIVITY_STARTED]: "movement:activity:started",
  [GameEventType.PATHFINDING_FAILED]: "pathfinding:failed",

  [GameEventType.DIALOGUE_SHOW_CARD]: "dialogue:card:show",
  [GameEventType.DIALOGUE_CARD_EXPIRED]: "dialogue:card:expired",
  [GameEventType.DIALOGUE_CARD_RESPONDED]: "dialogue:card:responded",

  [GameEventType.APPEARANCE_GENERATED]: "appearance:generated",
  [GameEventType.APPEARANCE_UPDATED]: "appearance:updated",

  [GameEventType.TRADE_OFFER_CREATED]: "trade:offer:created",
  [GameEventType.TRADE_COMPLETED]: "trade:completed",
  [GameEventType.TRADE_REJECTED]: "trade:rejected",

  [GameEventType.MARRIAGE_PROPOSED]: "marriage:proposed",
  [GameEventType.MARRIAGE_ACCEPTED]: "marriage:accepted",
  [GameEventType.MARRIAGE_REJECTED]: "marriage:rejected",
  [GameEventType.MARRIAGE_GROUP_FORMED]: "marriage:group:formed",
  [GameEventType.MARRIAGE_MEMBER_JOINED]: "marriage:member:joined",
  [GameEventType.MARRIAGE_MEMBER_LEFT]: "marriage:member:left",
  [GameEventType.DIVORCE_INITIATED]: "divorce:initiated",
  [GameEventType.DIVORCE_COMPLETED]: "divorce:completed",
  [GameEventType.WIDOWHOOD_REGISTERED]: "widowhood:registered",

  [GameEventType.SALARY_PAID]: "economy:salary:paid",
  [GameEventType.ECONOMY_RESERVATIONS_UPDATE]: "economy:reservations:update",

  [GameEventType.CRISIS_PREDICTION]: "crisis:prediction",
  [GameEventType.CRISIS_IMMEDIATE_WARNING]: "crisis:immediate:warning",

  [GameEventType.CHUNK_RENDERED]: "chunk:rendered",
  [GameEventType.TERRAIN_MODIFIED]: "terrain:modified",
  [GameEventType.TIME_CHANGED]: "time:changed",
  [GameEventType.TIME_WEATHER_CHANGED]: "time:weather:changed",
  [GameEventType.LEGEND_UPDATE]: "legend:update",
  [GameEventType.REPUTATION_UPDATED]: "reputation:updated",
  [GameEventType.GOVERNANCE_UPDATE]: "governance:update",
  [GameEventType.GOVERNANCE_ACTION]: "governance:action",
  [GameEventType.HOUSEHOLD_HIGH_OCCUPANCY]: "household:high:occupancy",
  [GameEventType.HOUSEHOLD_AGENTS_HOMELESS]: "household:agents:homeless",
  [GameEventType.HOUSEHOLD_NO_FREE_HOUSES]: "household:no:free:houses",
  [GameEventType.HOUSEHOLD_AGENT_ASSIGNED]: "household:agent:assigned",
  [GameEventType.HOUSEHOLD_AGENT_LEFT]: "household:agent:left",
  [GameEventType.HOUSEHOLD_RESOURCE_DEPOSITED]: "household:resource:deposited",
  [GameEventType.HOUSEHOLD_RESOURCE_WITHDRAWN]: "household:resource:withdrawn",
  [GameEventType.PRODUCTION_OUTPUT_GENERATED]: "production:output:generated",
  [GameEventType.PRODUCTION_WORKER_REMOVED]: "production:worker:removed",
  [GameEventType.CRAFTING_JOB_STARTED]: "crafting:job:started",
  [GameEventType.CRAFTING_JOB_COMPLETED]: "crafting:job:completed",
  [GameEventType.ITEM_GENERATED]: "item:generated",
  [GameEventType.ITEM_COLLECTED]: "item:collected",
  [GameEventType.INTERACTION_GAME_PLAYED]: "interaction:game:played",
  [GameEventType.EMERGENCE_METRICS_UPDATED]: "emergence:metrics:updated",
  [GameEventType.EMERGENCE_PATTERN_DETECTED]: "emergence:pattern:detected",
  [GameEventType.KNOWLEDGE_LEARNED]: "knowledge:learned",
  [GameEventType.KNOWLEDGE_SHARED]: "knowledge:shared",
  [GameEventType.KNOWLEDGE_ADDED]: "knowledge:added",
  [GameEventType.DIVINE_BLESSING_GRANTED]: "divine:blessing:granted",
  [GameEventType.REPRODUCTION_SUCCESS]: "reproduction:success",
  [GameEventType.REPRODUCTION_ATTEMPT]: "reproduction:attempt",
  [GameEventType.INVENTORY_DROPPED]: "inventory:dropped",
  [GameEventType.NEED_CRITICAL]: "need:critical",
  [GameEventType.NEED_SATISFIED]: "need:satisfied",
  [GameEventType.AGENT_ACTIVITY_STARTED]: "agent:activity:started",
  [GameEventType.ITEM_CRAFTED]: "item:crafted",
  [GameEventType.TASK_CREATED]: "task:created",
  [GameEventType.TASK_PROGRESS]: "task:progress",
  [GameEventType.TASK_COMPLETED]: "task:completed",
  [GameEventType.TASK_STALLED]: "task:stalled",
  [GameEventType.QUEST_COMPLETED]: "quest:completed",
  [GameEventType.QUEST_STARTED]: "quest:started",
  [GameEventType.QUEST_FAILED]: "quest:failed",
  [GameEventType.ROLE_ASSIGNED]: "role:assigned",
  [GameEventType.ROLE_REASSIGNED]: "role:reassigned",
  [GameEventType.ROLE_SHIFT_CHANGED]: "role:shift:changed",
  [GameEventType.ROLE_REBALANCED]: "role:rebalanced",
  [GameEventType.NORM_VIOLATED]: "norm:violated",
  [GameEventType.NORM_SANCTION_APPLIED]: "norm:sanction:applied",
  [GameEventType.CONFLICT_TRUCE_PROPOSED]: "conflict:truce:proposed",
  [GameEventType.CONFLICT_TRUCE_ACCEPTED]: "conflict:truce:accepted",
  [GameEventType.CONFLICT_TRUCE_REJECTED]: "conflict:truce:rejected",
  [GameEventType.THREAT_DETECTED]: "threat:detected",
};

/**
 * Maps a backend event name to frontend format
 * If no mapping exists, returns the original name
 */
export function mapEventName(backendEventName: GameEventType | string): string {
  if (backendEventName in eventNameMapper) {
    return eventNameMapper[backendEventName as GameEventType];
  }
  return backendEventName;
}
