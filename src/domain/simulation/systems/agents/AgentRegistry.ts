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
import type { GameState } from "@/shared/types/game-types";
import type { AgentProfile } from "@/shared/types/simulation/agents";
import type { AIState } from "@/shared/types/simulation/ai";
import type { EntityNeedsData } from "@/shared/types/simulation/needs";
import type { Inventory } from "@/shared/types/simulation/economy";

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
  [key: string]: unknown;
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
  private gameState: GameState;

  private profileIndex = new Map<string, AgentProfile>();
  private profileIndexDirty = true;
  private agentSpatialCache: {
    timestamp: number;
    cellSize: number;
    cells: Map<string, AgentProfile[]>;
  } | null = null;
  private readonly AGENT_SPATIAL_CACHE_TTL = 200; // ms
  private readonly AGENT_SPATIAL_CELL_SIZE = 600; // world units

  private aiStatesRef?: SystemMap<AIState>;
  private needsRef?: SystemMap<EntityNeedsData>;
  private movementRef?: SystemMap<MovementState>;
  private inventoryRef?: SystemMap<Inventory>;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    logger.debug("📋 AgentRegistry v2: Initialized as unified access layer");
  }

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
    this.invalidateSpatialCache();
    logger.debug(
      `📋 AgentRegistry: Rebuilt profile index (${this.profileIndex.size} agents)`,
    );
  }

  /**
   * Mark profile index as dirty (call when agents array changes)
   */
  public invalidateProfileIndex(): void {
    this.profileIndexDirty = true;
    this.invalidateSpatialCache();
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

  /**
   * Add a new agent profile to gameState.agents - O(1)
   * This is the single source of truth for adding agents.
   */
  public addAgent(profile: AgentProfile): void {
    if (!this.gameState.agents) {
      this.gameState.agents = [];
    }
    this.gameState.agents.push(profile);
    this.profileIndex.set(profile.id, profile);
    this.invalidateSpatialCache();
    logger.debug(`📋 AgentRegistry: Added agent ${profile.id}`);
  }

  /**
   * Remove agent from gameState.agents by ID - O(n) for array splice
   * This is the single source of truth for removing agents.
   * @returns true if agent was found and removed
   */
  public removeAgent(agentId: string): boolean {
    if (!this.gameState.agents) return false;

    const index = this.gameState.agents.findIndex((a) => a.id === agentId);
    if (index === -1) return false;

    this.gameState.agents.splice(index, 1);
    this.profileIndex.delete(agentId);
    this.invalidateSpatialCache();
    logger.debug(`📋 AgentRegistry: Removed agent ${agentId}`);
    return true;
  }

  /**
   * Get agent count - O(1)
   */
  public getAgentCount(): number {
    if (this.profileIndexDirty) {
      this.rebuildProfileIndex();
    }
    return this.profileIndex.size;
  }

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
    this.invalidateSpatialCache();
    logger.debug("📋 AgentRegistry: Cleared all references");
  }

  /**
   * Returns agents within a radius using a cached spatial grid.
   */
  public getAgentsInRadius(
    position: { x: number; y: number },
    radius: number,
    options: { excludeDead?: boolean } = {},
  ): AgentProfile[] {
    const cache = this.getAgentSpatialCache();
    if (!cache) return [];

    const cellSize = cache.cellSize;
    const radiusSq = radius * radius;
    const minCellX = Math.floor((position.x - radius) / cellSize);
    const maxCellX = Math.floor((position.x + radius) / cellSize);
    const minCellY = Math.floor((position.y - radius) / cellSize);
    const maxCellY = Math.floor((position.y + radius) / cellSize);

    const results: AgentProfile[] = [];
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const bucket = cache.cells.get(`${cellX},${cellY}`);
        if (!bucket) continue;

        for (const agent of bucket) {
          if (options.excludeDead && agent.isDead) continue;
          const agentPos = agent.position;
          if (!agentPos) continue;
          const dx = agentPos.x - position.x;
          const dy = agentPos.y - position.y;
          if (dx * dx + dy * dy <= radiusSq) {
            results.push(agent);
          }
        }
      }
    }

    return results;
  }

  private getAgentSpatialCache(): {
    timestamp: number;
    cellSize: number;
    cells: Map<string, AgentProfile[]>;
  } | null {
    const now = Date.now();
    if (
      !this.agentSpatialCache ||
      now - this.agentSpatialCache.timestamp > this.AGENT_SPATIAL_CACHE_TTL
    ) {
      this.agentSpatialCache = {
        timestamp: now,
        cellSize: this.AGENT_SPATIAL_CELL_SIZE,
        cells: this.buildAgentSpatialCells(),
      };
    }
    return this.agentSpatialCache;
  }

  private buildAgentSpatialCells(): Map<string, AgentProfile[]> {
    const cells = new Map<string, AgentProfile[]>();
    const cellSize = this.AGENT_SPATIAL_CELL_SIZE;
    const profiles = Array.from(this.getAllProfiles());

    for (const profile of profiles) {
      const pos = profile.position;
      if (!pos) continue;

      const cellX = Math.floor(pos.x / cellSize);
      const cellY = Math.floor(pos.y / cellSize);
      const key = `${cellX},${cellY}`;

      if (!cells.has(key)) {
        cells.set(key, []);
      }
      cells.get(key)!.push(profile);
    }

    return cells;
  }

  private invalidateSpatialCache(): void {
    this.agentSpatialCache = null;
  }
}
