import type { GameState } from "../../types/game-types";
import type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";
import type { AgentProfile } from "../../types/simulation/agents";
import type { SimulationEntity } from "../core/schema";
import type { Animal } from "../../types/simulation/animals";
import type { EntityNeedsData } from "../../types/simulation/needs";

/**
 * Delta Snapshot - Solo contiene los cambios desde el último snapshot
 */
export interface DeltaSnapshot {
  type: "delta" | "full";
  tick: number;
  updatedAt: number;
  events?: unknown[];
  changes?: Partial<GameState>;
  changedAgentIds?: string[];
  changedEntityIds?: string[];
}

/**
 * Codificador de deltas para reducir el tamaño de los snapshots enviados por WebSocket
 */
export class DeltaEncoder {
  private lastFullSnapshot: GameState | null = null;
  private ticksSinceFullSnapshot = 0;
  private readonly FULL_SNAPSHOT_INTERVAL = 100; // Enviar snapshot completo cada 100 ticks

  /**
   * Genera un delta snapshot comparando con el snapshot anterior
   */
  public encodeDelta(
    currentSnapshot: SimulationSnapshot,
    forceFull = false,
  ): DeltaSnapshot {
    const shouldSendFull =
      forceFull ||
      !this.lastFullSnapshot ||
      this.ticksSinceFullSnapshot >= this.FULL_SNAPSHOT_INTERVAL;

    if (shouldSendFull) {
      this.lastFullSnapshot = currentSnapshot.state;
      this.ticksSinceFullSnapshot = 0;

      return {
        type: "full",
        tick: currentSnapshot.tick,
        updatedAt: currentSnapshot.updatedAt,
        events: currentSnapshot.events,
        changes: currentSnapshot.state,
      };
    }

    this.ticksSinceFullSnapshot++;

    if (!this.lastFullSnapshot) {
      this.lastFullSnapshot = currentSnapshot.state;
      return {
        type: "full",
        tick: currentSnapshot.tick,
        updatedAt: currentSnapshot.updatedAt,
        events: currentSnapshot.events,
        changes: currentSnapshot.state,
      };
    }

    const changes = this.detectChanges(
      this.lastFullSnapshot,
      currentSnapshot.state,
    );

    this.lastFullSnapshot = currentSnapshot.state;

    return {
      type: "delta",
      tick: currentSnapshot.tick,
      updatedAt: currentSnapshot.updatedAt,
      events: currentSnapshot.events,
      changes,
      changedAgentIds: changes.agents?.map((a) => a.id),
      changedEntityIds: changes.entities?.map((e) => e.id),
    };
  }

  /**
   * Detecta los cambios entre dos estados
   * Optimizado: usa Maps para lookups O(1) en lugar de O(n)
   */
  private detectChanges(
    previous: GameState,
    current: GameState,
  ): Partial<GameState> {
    const changes: Partial<GameState> = {};

    const prevAgentMap = previous.agents
      ? new Map(previous.agents.map((a) => [a.id, a]))
      : new Map<string, AgentProfile>();
    const prevEntityMap = previous.entities
      ? new Map(previous.entities.map((e) => [e.id, e]))
      : new Map<string, SimulationEntity>();

    if (current.agents && previous.agents) {
      const changedAgents = current.agents.filter((agent) => {
        const prevAgent = prevAgentMap.get(agent.id);
        return !prevAgent || this.hasAgentChanged(prevAgent, agent);
      });

      if (changedAgents.length > 0) {
        changes.agents = changedAgents;
      }
    } else if (current.agents) {
      changes.agents = current.agents;
    }

    if (current.entities && previous.entities) {
      const changedEntities = current.entities.filter((entity) => {
        const prevEntity = prevEntityMap.get(entity.id);
        return !prevEntity || this.hasEntityChanged(prevEntity, entity);
      });

      if (changedEntities.length > 0) {
        changes.entities = changedEntities;
      }
    } else if (current.entities) {
      changes.entities = current.entities;
    }

    if (current.zones && this.hasArrayChanged(previous.zones, current.zones)) {
      changes.zones = current.zones;
    }

    if (current.worldResources) {
      const prevResources = previous.worldResources;
      if (
        !prevResources ||
        this.hasRecordChanged(prevResources, current.worldResources)
      ) {
        changes.worldResources = current.worldResources;
      }
    }

    if (current.animals && previous.animals) {
      const currentAnimals = current.animals.animals;
      const prevAnimals = previous.animals.animals;
      const prevAnimalMap = new Map(prevAnimals.map((a) => [a.id, a]));
      const changedAnimals = currentAnimals.filter((animal) => {
        const prevAnimal = prevAnimalMap.get(animal.id);
        return !prevAnimal || this.hasAnimalChanged(prevAnimal, animal);
      });

      if (changedAnimals.length > 0) {
        changes.animals = {
          ...current.animals,
          animals: changedAnimals,
        };
      }
    } else if (current.animals) {
      changes.animals = current.animals;
    }

    if (current.togetherTime !== previous.togetherTime) {
      changes.togetherTime = current.togetherTime;
    }

    if (current.dayTime !== previous.dayTime) {
      changes.dayTime = current.dayTime;
    }

    if (current.cycles !== previous.cycles) {
      changes.cycles = current.cycles;
    }

    if (current.resources) {
      changes.resources = current.resources;
    }

    return changes;
  }

  private hasAgentChanged(
    prev: AgentProfile & { needs?: EntityNeedsData; health?: number },
    current: AgentProfile & { needs?: EntityNeedsData; health?: number },
  ): boolean {
    if (
      prev.position?.x !== current.position?.x ||
      prev.position?.y !== current.position?.y
    ) {
      return true;
    }

    if (prev.needs && current.needs) {
      const needKeys = Object.keys(current.needs) as Array<
        keyof EntityNeedsData
      >;
      for (const key of needKeys) {
        if (prev.needs[key] !== current.needs[key]) {
          return true;
        }
      }
    }

    if (prev.health !== current.health) {
      return true;
    }

    return false;
  }

  private hasEntityChanged(
    prev: SimulationEntity & { activity?: string },
    current: SimulationEntity & { activity?: string },
  ): boolean {
    return (
      prev.position?.x !== current.position?.x ||
      prev.position?.y !== current.position?.y ||
      prev.activity !== current.activity
    );
  }

  private hasAnimalChanged(
    prev: Animal & { currentActivity?: string },
    current: Animal & { currentActivity?: string },
  ): boolean {
    return (
      prev.position?.x !== current.position?.x ||
      prev.position?.y !== current.position?.y ||
      prev.currentActivity !== current.currentActivity ||
      prev.health !== current.health
    );
  }

  private hasArrayChanged<T>(prev: T[] | undefined, current: T[]): boolean {
    if (!prev) return true;
    return prev.length !== current.length;
  }

  private hasRecordChanged(
    prev: Record<string, unknown>,
    current: Record<string, unknown>,
  ): boolean {
    const prevKeys = Object.keys(prev);
    const currentKeys = Object.keys(current);
    if (prevKeys.length !== currentKeys.length) return true;
    for (const key of currentKeys) {
      if (!(key in prev)) return true;
    }
    return false;
  }

  public reset(): void {
    this.lastFullSnapshot = null;
    this.ticksSinceFullSnapshot = 0;
  }

  public forceFullSnapshot(): void {
    this.ticksSinceFullSnapshot = this.FULL_SNAPSHOT_INTERVAL;
  }
}
