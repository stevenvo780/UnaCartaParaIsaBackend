/**
 * Maps backend event names (UPPER_SNAKE_CASE) to frontend event names (lowercase:colon:format)
 * This ensures compatibility between backend and frontend event systems
 */
export const eventNameMapper: Record<string, string> = {
  COMBAT_KILL: "combat:kill",
  COMBAT_HIT: "combat:hit",
  COMBAT_ENGAGED: "combat:engaged",
  COMBAT_WEAPON_EQUIPPED: "combat:weapon:equipped",
  COMBAT_WEAPON_CRAFTED: "combat:weapon:crafted",

  AGENT_BIRTH: "agent:birth",
  AGENT_DEATH: "agent:death",
  AGENT_AGED: "agent:aged",
  AGENT_RESPAWNED: "agent:respawned",
  AGENT_ACTION_COMPLETE: "agent:action:complete",
  AGENT_ACTION_COMMANDED: "agent:action:commanded",
  AGENT_GOAL_CHANGED: "agent:goal:changed",

  BUILDING_CONSTRUCTED: "building:constructed",
  BUILDING_DAMAGED: "building:damaged",
  BUILDING_REPAIRED: "building:repaired",
  BUILDING_CONSTRUCTION_STARTED: "building:construction:started",

  RESOURCE_GATHERED: "resource:gathered",
  RESOURCE_SPAWNED: "resource:spawned",
  RESOURCE_STATE_CHANGE: "resource:state:change",

  ANIMAL_SPAWNED: "animal:spawned",
  ANIMAL_DIED: "animal:died",
  ANIMAL_HUNTED: "animal:hunted",
  ANIMAL_CONSUMED_RESOURCE: "animal:consumed:resource",
  ANIMAL_REPRODUCED: "animal:reproduced",

  SOCIAL_RELATION_CHANGED: "social:relation:changed",
  SOCIAL_TRUCE_IMPOSED: "social:truce:imposed",
  SOCIAL_TRUCE_EXPIRED: "social:truce:expired",
  SOCIAL_RALLY: "social:rally",
  SOCIAL_GROUPS_UPDATE: "social:groups:update",

  MOVEMENT_ARRIVED_AT_ZONE: "movement:arrived:zone",
  MOVEMENT_ACTIVITY_COMPLETED: "movement:activity:completed",
  MOVEMENT_ACTIVITY_STARTED: "movement:activity:started",
  PATHFINDING_FAILED: "pathfinding:failed",

  DIALOGUE_SHOW_CARD: "dialogue:card:show",
  DIALOGUE_CARD_EXPIRED: "dialogue:card:expired",
  DIALOGUE_CARD_RESPONDED: "dialogue:card:responded",

  APPEARANCE_GENERATED: "appearance:generated",
  APPEARANCE_UPDATED: "appearance:updated",

  TRADE_OFFER_CREATED: "trade:offer:created",
  TRADE_COMPLETED: "trade:completed",
  TRADE_REJECTED: "trade:rejected",

  MARRIAGE_PROPOSED: "marriage:proposed",
  MARRIAGE_ACCEPTED: "marriage:accepted",
  MARRIAGE_REJECTED: "marriage:rejected",
  MARRIAGE_GROUP_FORMED: "marriage:group:formed",
  MARRIAGE_MEMBER_JOINED: "marriage:member:joined",
  MARRIAGE_MEMBER_LEFT: "marriage:member:left",
  DIVORCE_INITIATED: "divorce:initiated",
  DIVORCE_COMPLETED: "divorce:completed",
  WIDOWHOOD_REGISTERED: "widowhood:registered",

  SALARY_PAID: "economy:salary:paid",
  ECONOMY_RESERVATIONS_UPDATE: "economy:reservations:update",

  CRISIS_PREDICTION: "crisis:prediction",
  CRISIS_IMMEDIATE_WARNING: "crisis:immediate:warning",

  CHUNK_RENDERED: "chunk:rendered",
  TIME_CHANGED: "time:changed",
  TIME_WEATHER_CHANGED: "time:weather:changed",
  LEGEND_UPDATE: "legend:update",
  REPUTATION_UPDATED: "reputation:updated",
  GOVERNANCE_UPDATE: "governance:update",
  GOVERNANCE_ACTION: "governance:action",
  HOUSEHOLD_HIGH_OCCUPANCY: "household:high:occupancy",
  HOUSEHOLD_AGENTS_HOMELESS: "household:agents:homeless",
  HOUSEHOLD_NO_FREE_HOUSES: "household:no:free:houses",
  HOUSEHOLD_AGENT_ASSIGNED: "household:agent:assigned",
  HOUSEHOLD_RESOURCE_DEPOSITED: "household:resource:deposited",
  HOUSEHOLD_RESOURCE_WITHDRAWN: "household:resource:withdrawn",
  PRODUCTION_OUTPUT_GENERATED: "production:output:generated",
  PRODUCTION_WORKER_REMOVED: "production:worker:removed",
  CRAFTING_JOB_STARTED: "crafting:job:started",
  CRAFTING_JOB_COMPLETED: "crafting:job:completed",
  ITEM_GENERATED: "item:generated",
  ITEM_COLLECTED: "item:collected",
  INTERACTION_GAME_PLAYED: "interaction:game:played",
  EMERGENCE_METRICS_UPDATED: "emergence:metrics:updated",
  EMERGENCE_PATTERN_DETECTED: "emergence:pattern:detected",
  KNOWLEDGE_LEARNED: "knowledge:learned",
  KNOWLEDGE_SHARED: "knowledge:shared",
  KNOWLEDGE_ADDED: "knowledge:added",
  DIVINE_BLESSING_GRANTED: "divine:blessing:granted",
  REPRODUCTION_SUCCESS: "reproduction:success",
  REPRODUCTION_ATTEMPT: "reproduction:attempt",
  INVENTORY_DROPPED: "inventory:dropped",
  NEED_CRITICAL: "need:critical",
  NEED_SATISFIED: "need:satisfied",
  AGENT_ACTIVITY_STARTED: "agent:activity:started",
  RESOURCES_DEPOSITED: "resources:deposited",
  ITEM_CRAFTED: "item:crafted",
  TASK_CREATED: "task:created",
  TASK_PROGRESS: "task:progress",
  TASK_COMPLETED: "task:completed",
  TASK_STALLED: "task:stalled",
  QUEST_COMPLETED: "quest:completed",
  QUEST_STARTED: "quest:started",
  QUEST_FAILED: "quest:failed",
  ROLE_ASSIGNED: "role:assigned",
  ROLE_REASSIGNED: "role:reassigned",
  ROLE_SHIFT_CHANGED: "role:shift:changed",
  NORM_VIOLATED: "norm:violated",
  NORM_SANCTION_APPLIED: "norm:sanction:applied",
  CONFLICT_TRUCE_PROPOSED: "conflict:truce:proposed",
  CONFLICT_TRUCE_ACCEPTED: "conflict:truce:accepted",
  CONFLICT_TRUCE_REJECTED: "conflict:truce:rejected",
};

/**
 * Maps a backend event name to frontend format
 * If no mapping exists, returns the original name
 */
export function mapEventName(backendEventName: string): string {
  return eventNameMapper[backendEventName] || backendEventName;
}
