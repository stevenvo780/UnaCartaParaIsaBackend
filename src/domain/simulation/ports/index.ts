/**
 * Port interfaces for simulation systems
 *
 * These interfaces break circular dependencies by defining contracts
 * instead of requiring concrete implementations.
 *
 * @module domain/simulation/ports
 */

import type {
  AgentProfile,
  AgentTraits,
  LifeStage,
} from "@/shared/types/simulation/agents";
import type { EntityNeedsData } from "@/shared/types/simulation/needs";
import type { ResourceType, Inventory } from "@/shared/types/simulation/economy";

/**
 * Port for LifeCycleSystem operations
 *
 * Defines contract for agent lifecycle management without
 * requiring concrete LifeCycleSystem implementation.
 */
export interface ILifeCyclePort {
  /**
   * Spawns a new agent with specified characteristics
   */
  spawnAgent(spec: {
    id?: string;
    name?: string;
    sex: "male" | "female";
    ageYears: number;
    lifeStage: LifeStage;
    generation: number;
    immortal?: boolean;
    traits?: Partial<AgentTraits>;
  }): AgentProfile;

  /**
   * Removes an agent from the simulation
   */
  removeAgent(agentId: string): void;

  /**
   * Gets an agent by ID
   */
  getAgent(id: string): AgentProfile | undefined;

  /**
   * Gets agent current life stage
   */
  getLifeStage(ageYears: number): LifeStage;
}

/**
 * Port for NeedsSystem operations
 */
export interface INeedsPort {
  /**
   * Gets current needs state for an entity
   */
  getNeeds(entityId: string): EntityNeedsData | undefined;

  /**
   * Satisfies a specific need by an amount
   */
  satisfyNeed(
    entityId: string,
    needType: keyof EntityNeedsData,
    amount: number,
  ): void;

  /**
   * Initializes needs for a new entity
   */
  initializeNeeds(entityId: string): void;

  /**
   * Initializes needs for a new entity and returns the data
   */
  initializeEntityNeeds(entityId: string): EntityNeedsData;

  /**
   * Removes needs data for an entity
   */
  removeEntityNeeds(entityId: string): void;

  /**
   * Checks if an entity has critical needs
   */
  hasCriticalNeeds(entityId: string): boolean;
}

/**
 * Port for InventorySystem operations
 */
export interface IInventoryPort {
  /**
   * Gets agent's inventory
   */
  getAgentInventory(agentId: string): Inventory | undefined;

  /**
   * Adds resources to agent's inventory
   */
  addResource(agentId: string, resource: ResourceType, amount: number): boolean;

  /**
   * Removes resources from agent's inventory
   */
  removeFromAgent(
    agentId: string,
    resource: ResourceType,
    amount: number,
  ): number;

  /**
   * Consumes resources from agent
   */
  consumeFromAgent(
    agentId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean;

  /**
   * Transfers resources between agents atomically
   */
  transferBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): Record<ResourceType, number>;

  /**
   * Initializes inventory for a new agent
   */
  initializeAgentInventory(agentId: string, capacity?: number): Inventory;

  /**
   * Removes agent's inventory (on death)
   */
  removeAgentInventory(agentId: string): void;
}

/**
 * Port for MovementSystem operations
 */
export interface IMovementPort {
  /**
   * Starts movement to a zone
   */
  moveToZone(entityId: string, zoneId: string): void;

  /**
   * Starts movement to coordinates
   */
  moveToPoint(entityId: string, x: number, y: number): void;

  /**
   * Stops entity movement
   */
  stopMovement(entityId: string): void;

  /**
   * Removes all movement state for an entity (on death)
   */
  removeEntityMovement(entityId: string): void;

  /**
   * Gets entity's current position
   */
  getPosition(entityId: string): { x: number; y: number } | undefined;

  /**
   * Checks if entity is currently moving
   */
  isMoving(entityId: string): boolean;
}

/**
 * Port for SocialSystem operations
 */
export interface ISocialPort {
  /**
   * Gets relationship value between two agents
   */
  getAffinityBetween(agentId1: string, agentId2: string): number;

  /**
   * Modifies relationship between agents
   */
  modifyAffinity(agentId1: string, agentId2: string, delta: number): void;

  /**
   * Gets list of friends for an agent
   */
  getFriends(agentId: string): string[];

  /**
   * Adds social memory
   */
  addSocialMemory(
    agentId: string,
    memory: {
      type: string;
      targetId?: string;
      timestamp: number;
      [key: string]: unknown;
    },
  ): void;

  /**
   * Removes all relationships for an agent (e.g., when agent dies).
   * Cleans up edges, permanent bonds, truces, and infamy.
   */
  removeRelationships(agentId: string): void;
}

/**
 * Port for AISystem operations
 */
export interface IAIPort {
  /**
   * Sets goal for an agent
   */
  setGoal(
    agentId: string,
    goal: {
      type: string;
      priority: number;
      targetId?: string;
      targetZoneId?: string;
      data?: Record<string, unknown>;
    },
  ): void;

  /**
   * Clears all goals for an agent
   */
  clearGoals(agentId: string): void;

  /**
   * Gets current goal for agent
   */
  getCurrentGoal(agentId: string): unknown;

  /**
   * Removes all AI state for an agent (on death)
   */
  removeAgentState(agentId: string): void;
}

/**
 * Port for HouseholdSystem operations
 */
export interface IHouseholdPort {
  /**
   * Assigns agent to a household
   */
  assignToHouse(agentId: string, role?: string): string | null;

  /**
   * Gets household for an agent
   */
  getHouseFor(agentId: string): { id: string } | null;

  /**
   * Deposits resources to household
   */
  depositToHousehold(
    householdId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean;

  /**
   * Withdraws resources from household
   */
  withdrawFromHousehold(
    householdId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean;

  /**
   * Removes agent from their household (cleanup on death)
   */
  removeAgentFromHousehold(agentId: string): void;
}
