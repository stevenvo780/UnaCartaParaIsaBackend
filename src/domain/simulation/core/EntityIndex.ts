import type { AgentProfile } from "../../types/simulation/agents";
import type { SimulationEntity } from "./schema";
import type { GameState } from "../../types/game-types";

/**
 * Servicio centralizado para índices O(1) de entidades y agentes
 * Elimina búsquedas O(n) repetidas con array.find()
 */
export class EntityIndex {
  private agentIndex = new Map<string, AgentProfile>();
  private entityIndex = new Map<string, SimulationEntity>();
  private dirty = true;

  /**
   * Reconstruye los índices desde el GameState
   */
  public rebuild(state: GameState): void {
    if (!this.dirty) return;

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

    this.dirty = false;
  }

  /**
   * Marca el índice como dirty (necesita reconstrucción)
   */
  public markDirty(): void {
    this.dirty = true;
  }

  /**
   * Obtiene un agente por ID en O(1)
   */
  public getAgent(agentId: string): AgentProfile | undefined {
    return this.agentIndex.get(agentId);
  }

  /**
   * Obtiene una entidad por ID en O(1)
   */
  public getEntity(entityId: string): SimulationEntity | undefined {
    return this.entityIndex.get(entityId);
  }

  /**
   * Agrega o actualiza un agente en el índice
   */
  public setAgent(agent: AgentProfile): void {
    this.agentIndex.set(agent.id, agent);
  }

  /**
   * Agrega o actualiza una entidad en el índice
   */
  public setEntity(entity: SimulationEntity): void {
    this.entityIndex.set(entity.id, entity);
  }

  /**
   * Elimina un agente del índice
   */
  public removeAgent(agentId: string): void {
    this.agentIndex.delete(agentId);
  }

  /**
   * Elimina una entidad del índice
   */
  public removeEntity(entityId: string): void {
    this.entityIndex.delete(entityId);
  }

  /**
   * Obtiene todos los agentes (iterador eficiente)
   */
  public getAllAgents(): IterableIterator<AgentProfile> {
    return this.agentIndex.values();
  }

  /**
   * Obtiene todas las entidades (iterador eficiente)
   */
  public getAllEntities(): IterableIterator<SimulationEntity> {
    return this.entityIndex.values();
  }

  /**
   * Obtiene el número de agentes indexados
   */
  public getAgentCount(): number {
    return this.agentIndex.size;
  }

  /**
   * Obtiene el número de entidades indexadas
   */
  public getEntityCount(): number {
    return this.entityIndex.size;
  }

  /**
   * Verifica si un agente existe
   */
  public hasAgent(agentId: string): boolean {
    return this.agentIndex.has(agentId);
  }

  /**
   * Verifica si una entidad existe
   */
  public hasEntity(entityId: string): boolean {
    return this.entityIndex.has(entityId);
  }
}
