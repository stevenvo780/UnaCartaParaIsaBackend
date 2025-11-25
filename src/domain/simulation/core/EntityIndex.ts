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
}
