/**
 * Enumeration of panel names used for lazy-loading panel components.
 * These correspond to the TabId enum values and are used as keys in the PanelComponents registry.
 */
export enum PanelName {
  GAME = "game",
  ECONOMY = "economy",
  SOCIAL = "social",
  WORLD = "world",
  AGENTS = "agents",
  AIMONITOR = "aimonitor",
  ANIMALS = "animals",
  QUESTS = "quests",
  GOVERNANCE = "governance",
  GENEALOGY = "genealogy",
  SYSTEM = "system",
  COMBAT = "combat",
  ALERTS = "alerts",
  COMMERCE = "commerce",
  MARKET = "market",
  BLESSINGS = "blessings",
  ROLES = "roles",
  HOUSEHOLDS = "households",
  EVENTS = "events",
  CRAFTING = "crafting",
  RESEARCH = "research",
  BUILDINGS = "buildings",
  LOGS = "logs",
  SETTINGS = "settings",
}

/**
 * Type for panel name values.
 */
export type PanelNameValue = PanelName;
