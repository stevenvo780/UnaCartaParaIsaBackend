import type { AgentProfile } from "@/shared/types/simulation/agents";
import type { SimulationEntity, EntityTraits } from "./schema";
import type { GameState } from "@/shared/types/game-types";
import { injectable } from "inversify";
import { EntityType } from "../../../shared/constants/EntityEnums";

/**
 * Centralized service for O(1) entity and agent indexing.
 *
 * Uses granular dirty tracking to avoid O(n) full rebuilds.
 * Only rebuilds when there are actual structural changes to the data.
 * Supports incremental updates for better performance.
 *
 * @see SharedSpatialIndex for spatial queries
 */
@injectable()
export class EntityIndex {
  private agentIndex = new Map<string, AgentProfile>();
  private entityIndex = new Map<string, SimulationEntity>();
  private dirty = true;

  private lastAgentCount = 0;
  private lastEntityCount = 0;
  private pendingAgentAdds = new Set<string>();
  private pendingAgentRemoves = new Set<string>();
  private pendingEntityAdds = new Set<string>();
  private pendingEntityRemoves = new Set<string>();

  /**
   * Rebuilds the index with incremental O(Δn) updates instead of O(n) full rebuild.
   * Only processes pending changes unless threshold is exceeded.
   *
   * @param state - Current game state to index
   */
  public rebuild(state: GameState): void {
    const currentAgentCount = state.agents?.length ?? 0;
    const currentEntityCount = state.entities?.length ?? 0;

    const hasStructuralChanges =
      this.dirty ||
      currentAgentCount !== this.lastAgentCount ||
      currentEntityCount !== this.lastEntityCount ||
      this.pendingAgentAdds.size > 0 ||
      this.pendingAgentRemoves.size > 0 ||
      this.pendingEntityAdds.size > 0 ||
      this.pendingEntityRemoves.size > 0;

    if (!hasStructuralChanges) {
      return;
    }

    const totalPendingChanges =
      this.pendingAgentAdds.size +
      this.pendingAgentRemoves.size +
      this.pendingEntityAdds.size +
      this.pendingEntityRemoves.size;

    const threshold = Math.max(10, currentAgentCount * 0.2);

    if (this.dirty || totalPendingChanges > threshold) {
      this.rebuildFull(state);
    } else {
      this.rebuildIncremental(state);
    }

    this.lastAgentCount = currentAgentCount;
    this.lastEntityCount = currentEntityCount;
    this.dirty = false;
  }

  private rebuildFull(state: GameState): void {
    this.agentIndex.clear();
    this.entityIndex.clear();

    if (state.agents) {
      for (const agent of state.agents) {
        this.agentIndex.set(agent.id, agent);
      }
    }

    if (state.entities) {
      for (const entity of state.entities) {
        this.entityIndex.set(entity.id, entity);
      }
    }

    this.pendingAgentAdds.clear();
    this.pendingAgentRemoves.clear();
    this.pendingEntityAdds.clear();
    this.pendingEntityRemoves.clear();
  }

  private rebuildIncremental(state: GameState): void {
    for (const id of this.pendingAgentRemoves) {
      this.agentIndex.delete(id);
    }
    for (const id of this.pendingEntityRemoves) {
      this.entityIndex.delete(id);
    }

    if (state.agents) {
      for (const id of this.pendingAgentAdds) {
        const agent = state.agents.find((a) => a.id === id);
        if (agent) {
          this.agentIndex.set(id, agent);
        }
      }
    }

    if (state.entities) {
      for (const id of this.pendingEntityAdds) {
        const entity = state.entities.find((e) => e.id === id);
        if (entity) {
          this.entityIndex.set(id, entity);
        }
      }
    }

    this.pendingAgentAdds.clear();
    this.pendingAgentRemoves.clear();
    this.pendingEntityAdds.clear();
    this.pendingEntityRemoves.clear();
  }

  /**
   * Notifies the index that an agent was added.
   * Used for incremental updates.
   *
   * @param agentId - Agent identifier that was added
   */
  public notifyAgentAdded(agentId: string): void {
    this.pendingAgentRemoves.delete(agentId);
    this.pendingAgentAdds.add(agentId);
  }

  /**
   * Notifies the index that an agent was removed.
   * Used for incremental updates.
   *
   * @param agentId - Agent identifier that was removed
   */
  public notifyAgentRemoved(agentId: string): void {
    this.pendingAgentAdds.delete(agentId);
    this.pendingAgentRemoves.add(agentId);
  }

  /**
   * Notifies the index that an entity was added.
   * Used for incremental updates.
   *
   * @param entityId - Entity identifier that was added
   */
  public notifyEntityAdded(entityId: string): void {
    this.pendingEntityRemoves.delete(entityId);
    this.pendingEntityAdds.add(entityId);
  }

  /**
   * Notifies the index that an entity was removed.
   * Used for incremental updates.
   *
   * @param entityId - Entity identifier that was removed
   */
  public notifyEntityRemoved(entityId: string): void {
    this.pendingEntityAdds.delete(entityId);
    this.pendingEntityRemoves.add(entityId);
  }

  /**
   * Synchronizes agents with entities in GameState.
   * Ensures each agent has a corresponding entity in gameState.entities.
   * This is the centralized location for this synchronization.
   * Uses internal index for O(1) lookups.
   *
   * @param state - Game state to synchronize
   */
  public syncAgentsToEntities(state: GameState): void {
    if (!state.agents) return;

    if (!state.entities) {
      state.entities = [];
    }

    const entityMap =
      this.entityIndex.size > 0
        ? this.entityIndex
        : new Map(state.entities.map((e) => [e.id, e]));

    for (const agent of state.agents) {
      const existingEntity = entityMap.get(agent.id);
      if (existingEntity) {
        if (agent.position) {
          existingEntity.x = agent.position.x;
          existingEntity.y = agent.position.y;
          existingEntity.position = { ...agent.position };
        }
        this.entityIndex.set(agent.id, existingEntity);
        continue;
      }
      if (agent.position) {
        const entity: SimulationEntity = {
          id: agent.id,
          name: agent.name,
          x: agent.position.x,
          y: agent.position.y,
          position: { ...agent.position },
          isDead: false,
          type: EntityType.AGENT,
          traits: agent.traits as EntityTraits,
          immortal: agent.immortal,
          stats: {
            health: 100,
            stamina: 100,
          },
        };
        state.entities.push(entity);
        this.entityIndex.set(agent.id, entity);
      }
    }
  }

  /**
   * Marks the index as dirty, forcing a rebuild on next rebuild() call.
   */
  public markDirty(): void {
    this.dirty = true;
  }

  /**
   * Checks if the index is dirty and needs rebuilding.
   *
   * @returns True if dirty
   */
  public isDirty(): boolean {
    return (
      this.dirty ||
      this.pendingAgentAdds.size > 0 ||
      this.pendingAgentRemoves.size > 0 ||
      this.pendingEntityAdds.size > 0 ||
      this.pendingEntityRemoves.size > 0
    );
  }

  /**
   * Gets an agent by ID.
   *
   * @param agentId - Agent identifier
   * @returns Agent profile or undefined if not found
   */
  public getAgent(agentId: string): AgentProfile | undefined {
    return this.agentIndex.get(agentId);
  }

  /**
   * Gets an entity by ID.
   *
   * @param entityId - Entity identifier
   * @returns Simulation entity or undefined if not found
   */
  public getEntity(entityId: string): SimulationEntity | undefined {
    return this.entityIndex.get(entityId);
  }

  /**
   * Sets or updates an agent in the index.
   *
   * @param agent - Agent profile to index
   */
  public setAgent(agent: AgentProfile): void {
    this.agentIndex.set(agent.id, agent);
  }

  /**
   * Sets or updates an entity in the index.
   *
   * @param entity - Simulation entity to index
   */
  public setEntity(entity: SimulationEntity): void {
    this.entityIndex.set(entity.id, entity);
  }

  /**
   * Removes an agent from the index.
   *
   * @param agentId - Agent identifier to remove
   */
  public removeAgent(agentId: string): void {
    this.agentIndex.delete(agentId);
  }

  /**
   * Removes an entity from the index.
   *
   * @param entityId - Entity identifier to remove
   */
  public removeEntity(entityId: string): void {
    this.entityIndex.delete(entityId);
  }

  /**
   * Marks an entity as dead immediately and removes it from the agent index.
   * Prevents race conditions where other systems process dead agents
   * before the index is rebuilt on the next tick.
   *
   * @param entityId - ID of the entity to mark as dead
   */
  public markEntityDead(entityId: string): void {
    const entity = this.entityIndex.get(entityId);
    if (entity) {
      entity.isDead = true;
    }
    this.agentIndex.delete(entityId);
    this.dirty = true;
  }

  /**
   * Gets an iterator over all agents.
   *
   * @returns Iterator of agent profiles
   */
  public getAllAgents(): IterableIterator<AgentProfile> {
    return this.agentIndex.values();
  }

  /**
   * Gets an iterator over all entities.
   *
   * @returns Iterator of simulation entities
   */
  public getAllEntities(): IterableIterator<SimulationEntity> {
    return this.entityIndex.values();
  }

  /**
   * Gets the total number of indexed agents.
   *
   * @returns Agent count
   */
  public getAgentCount(): number {
    return this.agentIndex.size;
  }

  /**
   * Gets the total number of indexed entities.
   *
   * @returns Entity count
   */
  public getEntityCount(): number {
    return this.entityIndex.size;
  }

  /**
   * Checks if an agent exists in the index.
   *
   * @param agentId - Agent identifier to check
   * @returns True if agent exists
   */
  public hasAgent(agentId: string): boolean {
    return this.agentIndex.has(agentId);
  }

  /**
   * Checks if an entity exists in the index.
   *
   * @param entityId - Entity identifier to check
   * @returns True if entity exists
   */
  public hasEntity(entityId: string): boolean {
    return this.entityIndex.has(entityId);
  }

  /**
   * Finds both agent and entity for a given ID.
   *
   * @param entityId - Entity/agent identifier
   * @returns Object with optional agent and entity
   */
  public findEntityOrAgent(entityId: string): {
    agent?: AgentProfile;
    entity?: SimulationEntity;
  } {
    const agent = this.agentIndex.get(entityId);
    const entity = this.entityIndex.get(entityId);
    return { agent, entity };
  }

  /**
   * Gets or creates an entity from an agent.
   * If entity doesn't exist, creates it in the game state and indexes it.
   *
   * @param agentId - Agent identifier
   * @param state - Game state to modify if entity needs creation
   * @returns Simulation entity or undefined if agent not found or has no position
   */
  public getOrCreateEntityFromAgent(
    agentId: string,
    state: GameState,
  ): SimulationEntity | undefined {
    let entity = this.entityIndex.get(agentId);
    if (entity) return entity;

    const agent = this.agentIndex.get(agentId);
    if (!agent || !agent.position) return undefined;

    entity = {
      id: agent.id,
      name: agent.name,
      x: agent.position.x,
      y: agent.position.y,
      position: { ...agent.position },
      isDead: false,
      type: EntityType.AGENT,
      traits: agent.traits as EntityTraits,
      immortal: agent.immortal,
      stats: {
        health: 100,
        stamina: 100,
      },
    };

    if (!state.entities) {
      state.entities = [];
    }
    if (!state.entities.find((e) => e.id === agentId)) {
      state.entities.push(entity);
    }

    this.entityIndex.set(agentId, entity);
    return entity;
  }
}
