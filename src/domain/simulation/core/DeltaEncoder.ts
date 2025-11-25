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
  // Campos que cambiaron (solo se incluyen si hay cambios)
  changes?: Partial<GameState>;
  // IDs de entidades/agentes que cambiaron (para optimizar más)
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

    // Comparar con el último snapshot para detectar cambios
    // En este punto, lastFullSnapshot no puede ser null porque ya se verificó en shouldSendFull
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
   */
  private detectChanges(
    previous: GameState,
    current: GameState,
  ): Partial<GameState> {
    const changes: Partial<GameState> = {};

    // Comparar agentes (solo incluir los que cambiaron)
    if (current.agents && previous.agents) {
      const changedAgents = current.agents.filter((agent) => {
        const prevAgent = previous.agents.find((a) => a.id === agent.id);
        return !prevAgent || this.hasAgentChanged(prevAgent, agent);
      });

      if (changedAgents.length > 0) {
        changes.agents = changedAgents;
      }
    } else if (current.agents) {
      changes.agents = current.agents;
    }

    // Comparar entidades (solo incluir las que cambiaron)
    if (current.entities && previous.entities) {
      const changedEntities = current.entities.filter((entity) => {
        const prevEntity = previous.entities.find((e) => e.id === entity.id);
        return !prevEntity || this.hasEntityChanged(prevEntity, entity);
      });

      if (changedEntities.length > 0) {
        changes.entities = changedEntities;
      }
    } else if (current.entities) {
      changes.entities = current.entities;
    }

    // Comparar zones (solo si cambió el array completo)
    if (current.zones && this.hasArrayChanged(previous.zones, current.zones)) {
      changes.zones = current.zones;
    }

    // Comparar recursos (casi siempre cambia)
    if (current.worldResources) {
      const prevResources = previous.worldResources;
      if (
        !prevResources ||
        this.hasRecordChanged(prevResources, current.worldResources)
      ) {
        changes.worldResources = current.worldResources;
      }
    }

    // Comparar animales (solo los que cambiaron de posición o estado)
    if (current.animals && previous.animals) {
      const currentAnimals = current.animals.animals;
      const prevAnimals = previous.animals.animals;
      const changedAnimals = currentAnimals.filter((animal) => {
        const prevAnimal = prevAnimals.find((a) => a.id === animal.id);
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

    // Incluir otros campos solo si cambiaron
    if (current.togetherTime !== previous.togetherTime) {
      changes.togetherTime = current.togetherTime;
    }

    if (current.dayTime !== previous.dayTime) {
      changes.dayTime = current.dayTime;
    }

    if (current.cycles !== previous.cycles) {
      changes.cycles = current.cycles;
    }

    // Resources casi siempre cambian
    if (current.resources) {
      changes.resources = current.resources;
    }

    return changes;
  }

  /**
   * Verifica si un agente cambió comparando campos clave
   */
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

  /**
   * Verifica si una entidad cambió
   */
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

  /**
   * Verifica si un animal cambió
   */
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

  /**
   * Compara dos arrays por referencia y longitud
   */
  private hasArrayChanged<T>(prev: T[] | undefined, current: T[]): boolean {
    if (!prev) return true;
    return prev.length !== current.length;
  }

  /**
   * Compara dos Records por referencia y número de claves
   */
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

  /**
   * Reinicia el encoder
   */
  public reset(): void {
    this.lastFullSnapshot = null;
    this.ticksSinceFullSnapshot = 0;
  }

  /**
   * Fuerza el próximo snapshot como completo
   */
  public forceFullSnapshot(): void {
    this.ticksSinceFullSnapshot = this.FULL_SNAPSHOT_INTERVAL;
  }
}
