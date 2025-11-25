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

  // Tracking granular para evitar reconstrucciones innecesarias
  private lastAgentCount = 0;
  private lastEntityCount = 0;
  private pendingAgentAdds = new Set<string>();
  private pendingAgentRemoves = new Set<string>();
  private pendingEntityAdds = new Set<string>();
  private pendingEntityRemoves = new Set<string>();

  /**
   * OPTIMIZADO: Reconstrucción incremental O(Δn) en lugar de O(n)
   * Solo procesa cambios pendientes en lugar de reconstruir todo
   */
  public rebuild(state: GameState): void {
    // Si no hay cambios pendientes y el conteo es igual, no hacer nada
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
      return; // Early return - no hay cambios
    }

    // Si hay muchos cambios pendientes o es la primera vez, hacer rebuild completo
    const totalPendingChanges =
      this.pendingAgentAdds.size +
      this.pendingAgentRemoves.size +
      this.pendingEntityAdds.size +
      this.pendingEntityRemoves.size;

    const threshold = Math.max(10, currentAgentCount * 0.2);

    if (this.dirty || totalPendingChanges > threshold) {
      // Rebuild completo (pero optimizado)
      this.rebuildFull(state);
    } else {
      // Rebuild incremental
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

    // Limpiar pendientes después del rebuild completo
    this.pendingAgentAdds.clear();
    this.pendingAgentRemoves.clear();
    this.pendingEntityAdds.clear();
    this.pendingEntityRemoves.clear();
  }

  private rebuildIncremental(state: GameState): void {
    // Procesar removes primero
    for (const id of this.pendingAgentRemoves) {
      this.agentIndex.delete(id);
    }
    for (const id of this.pendingEntityRemoves) {
      this.entityIndex.delete(id);
    }

    // Procesar adds
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

    // Limpiar pendientes
    this.pendingAgentAdds.clear();
    this.pendingAgentRemoves.clear();
    this.pendingEntityAdds.clear();
    this.pendingEntityRemoves.clear();
  }

  /**
   * Notificar que se añadió un agente (para rebuild incremental)
   */
  public notifyAgentAdded(agentId: string): void {
    this.pendingAgentRemoves.delete(agentId);
    this.pendingAgentAdds.add(agentId);
  }

  /**
   * Notificar que se eliminó un agente (para rebuild incremental)
   */
  public notifyAgentRemoved(agentId: string): void {
    this.pendingAgentAdds.delete(agentId);
    this.pendingAgentRemoves.add(agentId);
  }

  /**
   * Notificar que se añadió una entidad (para rebuild incremental)
   */
  public notifyEntityAdded(entityId: string): void {
    this.pendingEntityRemoves.delete(entityId);
    this.pendingEntityAdds.add(entityId);
  }

  /**
   * Notificar que se eliminó una entidad (para rebuild incremental)
   */
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

    // Construir índice temporal de entidades existentes si no existe en entityIndex
    // Esto es O(n) una vez, en lugar de O(n) por cada agente
    const entityMap =
      this.entityIndex.size > 0
        ? this.entityIndex
        : new Map(state.entities.map((e) => [e.id, e]));

    for (const agent of state.agents) {
      // Usar lookup O(1) en lugar de .find() O(n)
      const existingEntity = entityMap.get(agent.id);
      if (existingEntity) {
        // Actualizar posición si el agente tiene posición
        if (agent.position) {
          existingEntity.x = agent.position.x;
          existingEntity.y = agent.position.y;
          existingEntity.position = { ...agent.position };
        }
        // Actualizar el índice interno
        this.entityIndex.set(agent.id, existingEntity);
        continue;
      }

      // Crear entidad desde agente si no existe
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
    // También remover del índice de agentes para que otros sistemas no lo procesen
    this.agentIndex.delete(entityId);
    // Marcar como dirty para que se reconstruya en el próximo tick
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

  /**
   * Busca una entidad por ID, primero en entities, luego en agents
   * Útil para sistemas que necesitan encontrar entidades sin saber
   * en qué array están almacenadas
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
   * Obtiene una entidad SimulationEntity, creándola desde un AgentProfile si es necesario
   */
  public getOrCreateEntityFromAgent(
    agentId: string,
    state: GameState,
  ): SimulationEntity | undefined {
    // Primero intentar obtener la entidad existente
    let entity = this.entityIndex.get(agentId);
    if (entity) return entity;

    // Si no existe, crear desde el agente
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

    // Agregar a gameState.entities si no existe
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
