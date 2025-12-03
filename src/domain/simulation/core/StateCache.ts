import type { GameState } from "@/shared/types/game-types";
import { cloneGameState, cloneGameStateDelta } from "./defaultState";

import { ZoneType } from "@/shared/constants/ZoneEnums";
/**
 * Intelligent caching system with dirty flags to optimize state cloning.
 * Only re-clones sections that have changed since the last snapshot.
 *
 * This significantly reduces memory allocation and improves performance
 * when sending state updates to clients via WebSocket.
 */
export class StateCache {
  private previousSnapshot: GameState | null = null;
  private dirtyFlags: Map<string, boolean> = new Map();
  private lastTick = -1;

  /**
   * Marks a state section as dirty, indicating it has changed.
   *
   * @param section - Section name (e.g., "agents", "entities", "zones")
   */
  public markDirty(section: string): void {
    this.dirtyFlags.set(section, true);
  }

  /**
   * Marks multiple state sections as dirty.
   *
   * @param sections - Array of section names to mark dirty
   */
  public markDirtyMultiple(sections: string[]): void {
    for (const section of sections) {
      this.dirtyFlags.set(section, true);
    }
  }

  /**
   * Clears all dirty flags.
   */
  public clearDirtyFlags(): void {
    this.dirtyFlags.clear();
  }

  /**
   * Gets an optimized snapshot of the state.
   * If a previous snapshot exists and not everything is dirty, uses delta cloning.
   * Otherwise, clones the entire state.
   *
   * @param state - Current game state
   * @param currentTick - Current simulation tick number
   * @returns Cloned game state snapshot
   */
  public getSnapshot(state: GameState, currentTick: number): GameState {
    if (currentTick !== this.lastTick) {
      this.lastTick = currentTick;
    }

    if (!this.previousSnapshot || this.isEverythingDirty()) {
      this.previousSnapshot = cloneGameState(state);
      this.clearDirtyFlags();
      return this.previousSnapshot;
    }

    const dirtyObj: Record<string, boolean> = {};
    for (const [section, isDirty] of this.dirtyFlags.entries()) {
      dirtyObj[section] = isDirty;
    }

    const snapshot = cloneGameStateDelta(
      state,
      dirtyObj,
      this.previousSnapshot,
    );
    this.previousSnapshot = snapshot;
    this.clearDirtyFlags();

    return snapshot;
  }

  private isEverythingDirty(): boolean {
    if (this.dirtyFlags.size === 0) {
      return true;
    }

    const allSections = [
      "agents",
      "entities",
      "animals",
      "zones",
      "worldResources",
      "inventory",
      "socialGraph",
      ZoneType.MARKET,
      "trade",
      "marriage",

      "conflicts",
      "research",
      "recipes",
      "reputation",
      "norms",
      "knowledgeGraph",
      "tasks",
    ];

    return allSections.every((section) => this.dirtyFlags.get(section));
  }

  /**
   * Resets the cache, clearing previous snapshot and dirty flags.
   */
  public reset(): void {
    this.previousSnapshot = null;
    this.clearDirtyFlags();
    this.lastTick = -1;
  }

  /**
   * Gets the previous snapshot without creating a new one.
   *
   * @returns Previous snapshot or null if none exists
   */
  public getPreviousSnapshot(): GameState | null {
    return this.previousSnapshot;
  }
}
