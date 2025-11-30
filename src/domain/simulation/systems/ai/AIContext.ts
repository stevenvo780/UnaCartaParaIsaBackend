/**
 * @fileoverview Unified context for AI decision-making.
 *
 * Replaces the multiple *Deps interfaces (AIActionPlannerDeps, AIGoalValidatorDeps,
 * AgentGoalPlannerDeps, etc.) with a single, cached, injectable adapter.
 *
 * This reduces boilerplate and indirection while providing type-safe access
 * to all systems needed for AI operations.
 */

import type { GameState } from "../../../types/game-types";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { AgentRole } from "../../../types/simulation/roles";
import type { Inventory, Stockpile } from "../../../types/simulation/economy";
import type { Task } from "../../../types/simulation/tasks";
import type { SettlementDemand } from "../../../types/simulation/governance";
import type { Quest } from "../../../types/simulation/quests";
import type { ResourceType as ResourceTypeImport } from "../../../../shared/constants/ResourceEnums";

// Re-export for convenience
export type ResourceType = ResourceTypeImport;

/**
 * Position type used throughout the AI system.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Resource location with optional type information.
 */
export interface ResourceLocation extends Position {
  id: string;
  type?: string;
}

/**
 * Animal location with type information.
 */
export interface AnimalLocation extends Position {
  id: string;
  type: string;
}

/**
 * Agent location with optional additional data.
 */
export interface AgentLocation extends Position {
  id: string;
  agentId?: string;
}

/**
 * Unified AI Context interface.
 *
 * Provides access to all game systems needed for AI decision-making
 * through a single, consistent interface.
 */
export interface IAIContext {
  // ─────────────────────────────────────────────────────────────────────────
  // Core State
  // ─────────────────────────────────────────────────────────────────────────

  /** Current game state */
  readonly gameState: GameState;

  /** Current timestamp */
  readonly now: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Queries
  // ─────────────────────────────────────────────────────────────────────────

  /** Get agent position by ID */
  getPosition(agentId: string): Position | null;

  /** Get agent's current needs */
  getNeeds(agentId: string): EntityNeedsData | null;

  /** Get agent's inventory */
  getInventory(agentId: string): Inventory | null;

  /** Get agent's current role */
  getRole(agentId: string): AgentRole | null;

  /** Get agent's combat strategy */
  getStrategy(agentId: string): "peaceful" | "tit_for_tat" | "bully";

  /** Check if agent is a warrior */
  isWarrior(agentId: string): boolean;

  /** Get all active agent IDs (cached) */
  getActiveAgentIds(): string[];

  /** Get nearby agents with distances */
  getNearbyAgents(agentId: string, radius: number): Promise<AgentLocation[]>;

  /** Get agent stats */
  getStats(agentId: string): Record<string, number> | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Queries
  // ─────────────────────────────────────────────────────────────────────────

  /** Find nearest resource of a type */
  findNearestResource(
    agentId: string,
    resourceType: string,
  ): ResourceLocation | null;

  /** Find nearest huntable animal */
  findNearestHuntableAnimal(
    agentId: string,
    excludeIds?: Set<string>,
  ): AnimalLocation | null;

  /** Find agent with excess resource to trade */
  findAgentWithResource(
    agentId: string,
    resourceType: ResourceType,
    minAmount: number,
  ): AgentLocation | null;

  /** Find potential mate for agent */
  findPotentialMate(agentId: string): AgentLocation | null;

  /** Find nearby agent for social interaction */
  findNearbyAgent(agentId: string): AgentLocation | null;

  /** Get all stockpiles */
  getAllStockpiles(): Stockpile[];

  // ─────────────────────────────────────────────────────────────────────────
  // Zone Queries
  // ─────────────────────────────────────────────────────────────────────────

  /** Get current zone for entity */
  getCurrentZone(entityId: string): string | null;

  /** Get suggested crafting zone */
  getSuggestedCraftZone(): string | null;

  /** Get zone IDs by type */
  getZonesByType(types: string[]): string[];

  // ─────────────────────────────────────────────────────────────────────────
  // Equipment & Crafting
  // ─────────────────────────────────────────────────────────────────────────

  /** Get equipped item ID */
  getEquipped(agentId: string): string | null;

  /** Check if agent can craft a weapon */
  canCraftWeapon(agentId: string, weaponId: string): boolean;

  /** Check if weapons are available in storage */
  hasAvailableWeapons(): boolean;

  /** Get agent's attack range based on equipment */
  getAttackRange(agentId: string): number;

  /** Check if agent has a weapon equipped */
  hasWeapon(agentId: string): boolean;

  /** Try to claim a weapon from storage */
  tryClaimWeapon(agentId: string): boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // Combat
  // ─────────────────────────────────────────────────────────────────────────

  /** Get enemies for agent above threshold */
  getEnemies(agentId: string, threshold?: number): string[];

  /** Get nearby predators */
  getNearbyPredators(pos: Position, range: number): AnimalLocation[];

  /** Get animal position */
  getAnimalPosition(animalId: string): Position | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Tasks & Quests
  // ─────────────────────────────────────────────────────────────────────────

  /** Get available community tasks */
  getAvailableTasks(): Task[];

  /** Claim a task for an agent */
  claimTask(taskId: string, agentId: string): boolean;

  /** Get active quests */
  getActiveQuests(): Quest[];

  /** Get available quests */
  getAvailableQuests(): Quest[];

  // ─────────────────────────────────────────────────────────────────────────
  // Colony & Time
  // ─────────────────────────────────────────────────────────────────────────

  /** Get current time of day */
  getTimeOfDay():
    | "dawn"
    | "morning"
    | "midday"
    | "afternoon"
    | "dusk"
    | "night"
    | "deep_night";

  /** Get colony population */
  getPopulation(): number;

  /** Get active demands */
  getActiveDemands(): SettlementDemand[];

  /** Get collective resource state */
  getCollectiveResourceState(): {
    foodPerCapita: number;
    waterPerCapita: number;
    stockpileFillRatio: number;
  } | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Knowledge
  // ─────────────────────────────────────────────────────────────────────────

  /** Get known resource alerts for agent */
  getKnownResourceAlerts(agentId: string): Array<{
    id: string;
    resourceId: string;
    resourceType: string;
    position: Position;
  }>;

  /** Get known threat alerts for agent */
  getKnownThreatAlerts(agentId: string): Array<{
    id: string;
    threatId: string;
    threatType: "predator" | "hostile_agent" | "danger_zone";
    position: Position;
    severity: number;
  }>;
}

/**
 * Cache configuration for AIContext.
 */
export interface AIContextCacheConfig {
  /** TTL for resource cache in ms */
  resourceCacheTTL: number;
  /** TTL for zone cache in ms */
  zoneCacheTTL: number;
  /** TTL for agent list cache in ms */
  agentListCacheTTL: number;
}

export const DEFAULT_CACHE_CONFIG: AIContextCacheConfig = {
  resourceCacheTTL: 2000,
  zoneCacheTTL: 2000,
  agentListCacheTTL: 1000,
};
