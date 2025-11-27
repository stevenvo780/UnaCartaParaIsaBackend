/**
 * AgentRegistry v2 - Unified Access Layer for Agent State
 *
 * STRATEGY: This registry does NOT store data - it REFERENCES data from existing systems.
 * Systems register their Maps here, and the registry provides unified O(1) access.
 *
 * This avoids:
 * - Data duplication (each system keeps its own Map)
 * - Logic duplication (systems keep their update logic)
 * - Migration complexity (systems opt-in gradually)
 *
 * Benefits:
 * - O(1) unified lookup across all agent data
 * - No synchronization needed between registry and systems
 * - Systems can migrate incrementally
 * - gameState.agents.find() calls can be replaced with registry.getProfile()
 *
 * @module core
 */

import { injectable, inject } from "inversify";
import { TYPES } from "@/config/Types";
import { logger } from "@/infrastructure/utils/logger";
import type { GameState } from "../../types/game-types";
import type { AgentProfile } from "../../types/simulation/agents";
import type { AIState } from "../../types/simulation/ai";
import type { EntityNeedsData } from "../../types/simulation/needs";
import type { Inventory } from "../../types/simulation/economy";

/**
 * Movement state interface (compatible with MovementSystem.EntityMovementState)
 */
export interface MovementState {
  entityId: string;
  currentPosition: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  targetZone?: string;
  isMoving: boolean;
  currentPath: Array<{ x: number; y: number }>;
  currentActivity: string;
  fatigue: number;
  [key: string]: unknown; // Allow additional properties from MovementSystem
}

/**
 * Type for system Maps that can be registered
 */
type SystemMap<T> = Map<string, T> | (() => Map<string, T>);

/**
 * AgentRegistry - Unified access layer that references system Maps
 *
 * Instead of duplicating data, this registry holds references to the
 * existing Maps from each system. Systems register their Maps on init.
 */
@injectable()
export class AgentRegistry {
  // Reference to gameState for profile lookups
  private gameState: GameState;

  // Profile index for O(1) lookups (built from gameState.agents)
  private profileIndex = new Map<string, AgentProfile>();
  private profileIndexDirty = true;

  // References to system Maps (lazy or direct)
  private aiStatesRef?: SystemMap<AIState>;
  private needsRef?: SystemMap<EntityNeedsData>;
  private movementRef?: SystemMap<MovementState>;
  private inventoryRef?: SystemMap<Inventory>;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    logger.debug("📋 AgentRegistry v2: Initialized as unified access layer");
  }

  // ============================================================
  // SYSTEM REGISTRATION - Systems register their Maps here
  // ============================================================

  /**
   * Register AISystem's aiStates Map
   */
  public registerAIStates(map: SystemMap<AIState>): void {
    this.aiStatesRef = map;
    logger.debug("📋 AgentRegistry: AIStates registered");
  }

  /**
   * Register NeedsSystem's entityNeeds Map
   */
  public registerNeeds(map: SystemMap<EntityNeedsData>): void {
    this.needsRef = map;
    logger.debug("📋 AgentRegistry: Needs registered");
  }

  /**
   * Register MovementSystem's movementStates Map
   */
  public registerMovement(map: SystemMap<MovementState>): void {
    this.movementRef = map;
    logger.debug("📋 AgentRegistry: Movement registered");
  }

  /**
   * Register InventorySystem's agentInventories Map
   */
  public registerInventory(map: SystemMap<Inventory>): void {
    this.inventoryRef = map;
    logger.debug("📋 AgentRegistry: Inventory registered");
  }

  // ============================================================
  // PROFILE ACCESS - O(1) lookup instead of gameState.agents.find()
  // ============================================================

  /**
   * Rebuilds the profile index from gameState.agents
   * Call this when agents are added/removed
   */
  public rebuildProfileIndex(): void {
    this.profileIndex.clear();
    for (const agent of this.gameState.agents) {
      this.profileIndex.set(agent.id, agent);
    }
    this.profileIndexDirty = false;
    logger.debug(
      `📋 AgentRegistry: Rebuilt profile index (${this.profileIndex.size} agents)`,
    );
  }

  /**
   * Mark profile index as dirty (call when agents array changes)
   */
  public invalidateProfileIndex(): void {
    this.profileIndexDirty = true;
  }

  /**
   * Get agent profile by ID - O(1) instead of O(n) find()
   */
  public getProfile(agentId: string): AgentProfile | undefined {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    return this.profileIndex.get(agentId);
  }

  /**
   * Check if agent exists - O(1)
   */
  public hasAgent(agentId: string): boolean {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    return this.profileIndex.has(agentId);
  }

  /**
   * Get all agent IDs - O(1) after index built
   */
  public getAllAgentIds(): string[] {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    return Array.from(this.profileIndex.keys());
  }

  /**
   * Get all profiles iterator - O(1)
   */
  public getAllProfiles(): IterableIterator<AgentProfile> {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    return this.profileIndex.values();
  }

  /**
   * Get alive agents - filters isDead
   */
  public getAliveAgentIds(): string[] {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    const alive: string[] = [];
    for (const [id, profile] of this.profileIndex) {
      if (!profile.isDead) {
        alive.push(id);
      }
    }
    return alive;
  }

  // ============================================================
  // COMPONENT ACCESS - Delegates to registered system Maps
  // ============================================================

  private resolveMap<T>(ref?: SystemMap<T>): Map<string, T> | undefined {
    if (!ref) return undefined;
    return typeof ref === "function" ? ref() : ref;
  }

  /**
   * Get AI state by agent ID - O(1)
   */
  public getAIState(agentId: string): AIState | undefined {
    const map = this.resolveMap(this.aiStatesRef);
    return map?.get(agentId);
  }

  /**
   * Get needs by agent ID - O(1)
   */
  public getNeeds(agentId: string): EntityNeedsData | undefined {
    const map = this.resolveMap(this.needsRef);
    return map?.get(agentId);
  }

  /**
   * Get movement state by agent ID - O(1)
   */
  public getMovement(agentId: string): MovementState | undefined {
    const map = this.resolveMap(this.movementRef);
    return map?.get(agentId);
  }

  /**
   * Get inventory by agent ID - O(1)
   */
  public getInventory(agentId: string): Inventory | undefined {
    const map = this.resolveMap(this.inventoryRef);
    return map?.get(agentId);
  }

  // ============================================================
  // UNIFIED ACCESS - Get all data for an agent in one call
  // ============================================================

  /**
   * Get complete agent data snapshot - useful for debugging/serialization
   */
  public getAgentSnapshot(agentId: string): {
    profile?: AgentProfile;
    ai?: AIState;
    needs?: EntityNeedsData;
    movement?: MovementState;
    inventory?: Inventory;
  } | null {
    const profile = this.getProfile(agentId);
    if (!profile) return null;

    return {
      profile,
      ai: this.getAIState(agentId),
      needs: this.getNeeds(agentId),
      movement: this.getMovement(agentId),
      inventory: this.getInventory(agentId),
    };
  }

  /**
   * Get agent position - tries movement first, falls back to profile
   */
  public getPosition(agentId: string): { x: number; y: number } | undefined {
    const movement = this.getMovement(agentId);
    if (movement?.currentPosition) {
      return movement.currentPosition;
    }
    const profile = this.getProfile(agentId);
    return profile?.position;
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  public getStats(): {
    totalAgents: number;
    aliveAgents: number;
    hasAI: number;
    hasNeeds: number;
    hasMovement: number;
    hasInventory: number;
  } {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }

    const aiMap = this.resolveMap(this.aiStatesRef);
    const needsMap = this.resolveMap(this.needsRef);
    const movementMap = this.resolveMap(this.movementRef);
    const inventoryMap = this.resolveMap(this.inventoryRef);

    let alive = 0;
    for (const profile of this.profileIndex.values()) {
      if (!profile.isDead) alive++;
    }

    return {
      totalAgents: this.profileIndex.size,
      aliveAgents: alive,
      hasAI: aiMap?.size ?? 0,
      hasNeeds: needsMap?.size ?? 0,
      hasMovement: movementMap?.size ?? 0,
      hasInventory: inventoryMap?.size ?? 0,
    };
  }

  /**
   * Clear all references (for testing/reset)
   */
  public clear(): void {
    this.profileIndex.clear();
    this.profileIndexDirty = true;
    this.aiStatesRef = undefined;
    this.needsRef = undefined;
    this.movementRef = undefined;
    this.inventoryRef = undefined;
    logger.debug("📋 AgentRegistry: Cleared all references");
  }
}
