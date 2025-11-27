import type { GameState } from "../../types/game-types";
import type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";
import type { AgentProfile } from "../../types/simulation/agents";
import type { SimulationEntity } from "../core/schema";
import type { Animal } from "../../types/simulation/animals";
import type { EntityNeedsData } from "../../types/simulation/needs";
import {
  SnapshotType,
  SystemProperty,
} from "../../../shared/constants/SystemEnums";

/**
 * Delta snapshot containing only changes since the last snapshot.
 * Used to reduce WebSocket payload size by sending only modified data.
 */
export interface DeltaSnapshot {
  type: SnapshotType;
  tick: number;
  updatedAt: number;
  events?: unknown[];
  changes?: Partial<GameState>;
  changedAgentIds?: string[];
  changedEntityIds?: string[];
}

/**
 * Delta encoder for reducing WebSocket snapshot payload size.
 *
 * Compares current state with previous snapshot and sends only changes.
 * Periodically sends full snapshots to ensure client state consistency.
 */
export class DeltaEncoder {
  private lastFullSnapshot: GameState | null = null;
  private ticksSinceFullSnapshot = 0;
  /** Send full snapshot every 100 ticks to ensure consistency */
  private readonly FULL_SNAPSHOT_INTERVAL = 100;

  /**
   * Generates a delta snapshot by comparing with the previous snapshot.
   *
   * @param currentSnapshot - Current simulation snapshot
   * @param forceFull - Force a full snapshot regardless of interval
   * @returns Delta snapshot with only changes, or full snapshot if needed
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
        type: SnapshotType.FULL,
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
        type: SnapshotType.FULL,
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
      type: SnapshotType.DELTA,
      tick: currentSnapshot.tick,
      updatedAt: currentSnapshot.updatedAt,
      events: currentSnapshot.events,
      changes,
      changedAgentIds: changes.agents?.map((a) => a.id),
      changedEntityIds: changes.entities?.map((e) => e.id),
    };
  }

  /**
   * Detects changes between two game states.
   * Optimized: uses Maps for O(1) lookups instead of O(n).
   *
   * @param previous - Previous game state
   * @param current - Current game state
   * @returns Partial game state containing only changed sections
   */
  private detectChanges(
    previous: GameState,
    current: GameState,
  ): Partial<GameState> {
    const changes: Partial<GameState> = {};

    // @ts-expect-error - prevAgentMap reserved for future use
    const _prevAgentMap = previous.agents
      ? new Map(previous.agents.map((a) => [a.id, a]))
      : new Map<string, AgentProfile>();
    const prevEntityMap = previous.entities
      ? new Map(previous.entities.map((e) => [e.id, e]))
      : new Map<string, SimulationEntity>();

    if (current.agents) {
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

    if (current[SystemProperty.INVENTORY]) {
      const prevInventory = previous[SystemProperty.INVENTORY];
      if (
        !prevInventory ||
        this.hasInventoryChanged(
          prevInventory,
          current[SystemProperty.INVENTORY],
        )
      ) {
        changes[SystemProperty.INVENTORY] = current[SystemProperty.INVENTORY];
      }
    }

    return changes;
  }

  private hasInventoryChanged(
    prev: GameState["inventory"],
    current: GameState["inventory"],
  ): boolean {
    if (!prev || !current) return true;

    if (
      prev.global.wood !== current.global.wood ||
      prev.global.stone !== current.global.stone ||
      prev.global.food !== current.global.food ||
      prev.global.water !== current.global.water
    ) {
      return true;
    }

    const prevStockpileKeys = Object.keys(prev.stockpiles);
    const currStockpileKeys = Object.keys(current.stockpiles);
    if (prevStockpileKeys.length !== currStockpileKeys.length) return true;

    for (const key of currStockpileKeys) {
      const p = prev.stockpiles[key];
      const c = current.stockpiles[key];
      if (!p) return true;
      if (
        p.inventory.wood !== c.inventory.wood ||
        p.inventory.stone !== c.inventory.stone ||
        p.inventory.food !== c.inventory.food ||
        p.inventory.water !== c.inventory.water
      ) {
        return true;
      }
    }

    const prevAgentKeys = Object.keys(prev.agents);
    const currAgentKeys = Object.keys(current.agents);
    if (prevAgentKeys.length !== currAgentKeys.length) return true;

    for (const key of currAgentKeys) {
      const p = prev.agents[key];
      const c = current.agents[key];
      if (!p) return true;
      if (
        p.wood !== c.wood ||
        p.stone !== c.stone ||
        p.food !== c.food ||
        p.water !== c.water
      ) {
        return true;
      }
    }

    return false;
  }

  // @ts-expect-error - hasAgentChanged reserved for future use
  private hasAgentChanged(
    prev: AgentProfile & {
      needs?: EntityNeedsData;
      health?: number;
      ai?: unknown;
    },
    current: AgentProfile & {
      needs?: EntityNeedsData;
      health?: number;
      ai?: unknown;
    },
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

    if (prev.ai !== current.ai) {
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
    if (
      prev.position?.x !== current.position?.x ||
      prev.position?.y !== current.position?.y ||
      prev.currentActivity !== current.currentActivity ||
      prev.health !== current.health
    ) {
      return true;
    }

    if (prev.needs && current.needs) {
      return (
        prev.needs.hunger !== current.needs.hunger ||
        prev.needs.thirst !== current.needs.thirst ||
        prev.needs.fear !== current.needs.fear ||
        prev.needs.reproductiveUrge !== current.needs.reproductiveUrge
      );
    }

    return false;
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

  /**
   * Resets the encoder, clearing the last full snapshot.
   */
  public reset(): void {
    this.lastFullSnapshot = null;
    this.ticksSinceFullSnapshot = 0;
  }

  /**
   * Forces the next encodeDelta call to return a full snapshot.
   */
  public forceFullSnapshot(): void {
    this.ticksSinceFullSnapshot = this.FULL_SNAPSHOT_INTERVAL;
  }
}
