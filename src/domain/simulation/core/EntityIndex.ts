import type { AgentProfile } from "../../types/simulation/agents";
import type { SimulationEntity, EntityTraits } from "./schema";
import type { GameState } from "../../types/game-types";
import { injectable } from "inversify";

/**
 * Servicio centralizado para índices O(1) de entidades y agentes
 * OPTIMIZADO: Usa dirty tracking granular para evitar reconstrucciones O(n)
 * Solo reconstruye cuando hay cambios reales en la estructura de datos
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
   * Reconstrucción incremental O(Δn) en lugar de O(n)
   * Solo procesa cambios pendientes en lugar de reconstruir todo
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

  public notifyAgentAdded(agentId: string): void {
    this.pendingAgentRemoves.delete(agentId);
    this.pendingAgentAdds.add(agentId);
  }

  public notifyAgentRemoved(agentId: string): void {
    this.pendingAgentAdds.delete(agentId);
    this.pendingAgentRemoves.add(agentId);
  }

  public notifyEntityAdded(entityId: string): void {
    this.pendingEntityRemoves.delete(entityId);
    this.pendingEntityAdds.add(entityId);
  }

  public notifyEntityRemoved(entityId: string): void {
    this.pendingEntityAdds.delete(entityId);
    this.pendingEntityRemoves.add(entityId);
  }

  /**
   * Sincroniza agents con entities en GameState.
   * Asegura que cada agente tenga su entidad correspondiente en gameState.entities.
   * Este es el lugar centralizado para esta sincronización.
   * Optimizado: usa el índice interno para lookups O(1)
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
          type: "agent",
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

  public markDirty(): void {
    this.dirty = true;
  }

  public getAgent(agentId: string): AgentProfile | undefined {
    return this.agentIndex.get(agentId);
  }

  public getEntity(entityId: string): SimulationEntity | undefined {
    return this.entityIndex.get(entityId);
  }

  public setAgent(agent: AgentProfile): void {
    this.agentIndex.set(agent.id, agent);
  }

  public setEntity(entity: SimulationEntity): void {
    this.entityIndex.set(entity.id, entity);
  }

  public removeAgent(agentId: string): void {
    this.agentIndex.delete(agentId);
  }

  public removeEntity(entityId: string): void {
    this.entityIndex.delete(entityId);
  }

  /**
   * Marca una entidad como muerta inmediatamente y la remueve del índice de agentes.
   * Esto previene race conditions donde otros sistemas procesan agentes muertos
   * antes de que el índice se reconstruya en el próximo tick.
   */
  public markEntityDead(entityId: string): void {
    const entity = this.entityIndex.get(entityId);
    if (entity) {
      entity.isDead = true;
    }
    this.agentIndex.delete(entityId);
    this.dirty = true;
  }

  public getAllAgents(): IterableIterator<AgentProfile> {
    return this.agentIndex.values();
  }

  public getAllEntities(): IterableIterator<SimulationEntity> {
    return this.entityIndex.values();
  }

  public getAgentCount(): number {
    return this.agentIndex.size;
  }

  public getEntityCount(): number {
    return this.entityIndex.size;
  }

  public hasAgent(agentId: string): boolean {
    return this.agentIndex.has(agentId);
  }

  public hasEntity(entityId: string): boolean {
    return this.entityIndex.has(entityId);
  }

  public findEntityOrAgent(entityId: string): {
    agent?: AgentProfile;
    entity?: SimulationEntity;
  } {
    const agent = this.agentIndex.get(entityId);
    const entity = this.entityIndex.get(entityId);
    return { agent, entity };
  }

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
      type: "agent",
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
