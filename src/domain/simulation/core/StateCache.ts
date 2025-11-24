import type { GameState } from "../../types/game-types";
import { cloneGameState, cloneGameStateDelta } from "./defaultState";

/**
 * Sistema de cache inteligente con dirty flags para optimizar la clonación del estado
 * Solo re-clona las secciones que han cambiado desde el último snapshot
 */
export class StateCache {
  private previousSnapshot: GameState | null = null;
  private dirtyFlags: Map<string, boolean> = new Map();
  private lastTick = -1;

  /**
   * Marca una sección del estado como "dirty" (ha cambiado)
   */
  public markDirty(section: string): void {
    this.dirtyFlags.set(section, true);
  }

  /**
   * Marca múltiples secciones como dirty
   */
  public markDirtyMultiple(sections: string[]): void {
    for (const section of sections) {
      this.dirtyFlags.set(section, true);
    }
  }

  /**
   * Resetea todos los dirty flags
   */
  public clearDirtyFlags(): void {
    this.dirtyFlags.clear();
  }

  /**
   * Obtiene un snapshot optimizado del estado
   * Si hay un snapshot previo y no todo está dirty, usa clonación delta
   * Si no, clona todo el estado
   */
  public getSnapshot(state: GameState, currentTick: number): GameState {
    // Si es un nuevo tick, resetear flags
    if (currentTick !== this.lastTick) {
      this.lastTick = currentTick;
    }

    // Si no hay snapshot previo o todo está dirty, clonar todo
    if (!this.previousSnapshot || this.isEverythingDirty()) {
      this.previousSnapshot = cloneGameState(state);
      this.clearDirtyFlags();
      return this.previousSnapshot;
    }

    // Usar clonación delta para solo clonar lo que cambió
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

  /**
   * Verifica si todas las secciones están marcadas como dirty
   */
  private isEverythingDirty(): boolean {
    // Si no hay flags, asumir que todo está dirty
    if (this.dirtyFlags.size === 0) {
      return true;
    }

    // Lista de todas las secciones posibles
    const allSections = [
      "agents",
      "entities",
      "animals",
      "zones",
      "worldResources",
      "inventory",
      "socialGraph",
      "market",
      "trade",
      "marriage",
      "quests",
      "conflicts",
      "research",
      "recipes",
      "reputation",
      "norms",
      "knowledgeGraph",
      "tasks",
    ];

    // Si todas las secciones están marcadas como dirty, clonar todo
    return allSections.every((section) => this.dirtyFlags.get(section));
  }

  /**
   * Resetea el cache completamente (útil cuando el estado cambia drásticamente)
   */
  public reset(): void {
    this.previousSnapshot = null;
    this.clearDirtyFlags();
    this.lastTick = -1;
  }

  /**
   * Obtiene el snapshot previo sin clonarlo (para comparaciones)
   */
  public getPreviousSnapshot(): GameState | null {
    return this.previousSnapshot;
  }
}

