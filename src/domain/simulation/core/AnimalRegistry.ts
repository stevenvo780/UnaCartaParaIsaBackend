/**
 * AnimalRegistry - Single Source of Truth for Animal State (ECS Pattern)
 *
 * Centralizes all animal-related data that was previously in:
 * - AnimalSystem.animals Map
 * - gameState.animals.animals Array (duplicated snapshot)
 *
 * Benefits:
 * - O(1) lookup for any animal data
 * - No duplication between AnimalSystem and gameState
 * - Spatial indexing for efficient proximity queries
 * - Single point of synchronization
 *
 * @module core
 */

import { injectable } from "inversify";
import { logger } from "@/infrastructure/utils/logger";
import type { Animal, AnimalNeeds } from "../../types/simulation/animals";
import {
  AnimalState,
  AnimalType,
  AnimalTargetType,
} from "../../../shared/constants/AnimalEnums";

/**
 * Grid cell size for spatial indexing (256px cells)
 */
const GRID_CELL_SIZE = 256;

/**
 * AnimalRegistry - Central registry for all animal state (ECS pattern)
 *
 * All systems should use this registry to access and modify animal data
 * instead of maintaining their own copies.
 */
@injectable()
export class AnimalRegistry {
  private animals = new Map<string, Animal>();
  private spatialGrid = new Map<string, Set<string>>();
  private dirtyAnimals = new Set<string>();
  private lastCleanup = 0;
  private readonly CLEANUP_INTERVAL = 30000;

  private statsCache: {
    total: number;
    byType: Record<string, number>;
    alive: number;
    dirty: boolean;
  } = { total: 0, byType: {}, alive: 0, dirty: true };

  /**
   * Registers a new animal
   */
  public registerAnimal(animal: Animal): void {
    this.animals.set(animal.id, animal);
    this.addToSpatialGrid(animal);
    this.dirtyAnimals.add(animal.id);
    this.statsCache.dirty = true;

    logger.debug(
      `🐾 AnimalRegistry: Registered ${animal.type} (${animal.id}) at (${animal.position.x.toFixed(0)}, ${animal.position.y.toFixed(0)})`,
    );
  }

  /**
   * Removes an animal from the registry
   */
  public removeAnimal(animalId: string): boolean {
    const animal = this.animals.get(animalId);
    if (!animal) return false;

    this.removeFromSpatialGrid(animal);
    this.animals.delete(animalId);
    this.dirtyAnimals.delete(animalId);
    this.statsCache.dirty = true;

    logger.debug(`🐾 AnimalRegistry: Removed animal ${animalId}`);
    return true;
  }

  /**
   * Gets an animal by ID - O(1)
   */
  public getAnimal(animalId: string): Animal | undefined {
    return this.animals.get(animalId);
  }

  /**
   * Checks if an animal exists - O(1)
   */
  public hasAnimal(animalId: string): boolean {
    return this.animals.has(animalId);
  }

  /**
   * Updates animal position and spatial index
   */
  public updatePosition(animalId: string, x: number, y: number): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    this.removeFromSpatialGrid(animal);

    animal.position.x = x;
    animal.position.y = y;

    this.addToSpatialGrid(animal);
    this.markDirty(animalId);
  }

  /**
   * Updates animal state
   */
  public updateState(animalId: string, state: AnimalState): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.state = state;
    this.markDirty(animalId);
  }

  /**
   * Updates animal needs
   */
  public updateNeeds(animalId: string, updates: Partial<AnimalNeeds>): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        animal.needs[key as keyof AnimalNeeds] = Math.max(
          0,
          Math.min(100, value),
        );
      }
    }
    this.markDirty(animalId);
  }

  /**
   * Updates animal health
   */
  public updateHealth(animalId: string, health: number): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.health = Math.max(0, health);
    if (animal.health <= 0) {
      animal.isDead = true;
    }
    this.markDirty(animalId);
  }

  /**
   * Marks an animal as dead
   */
  public markDead(animalId: string): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.isDead = true;
    animal.health = 0;
    this.markDirty(animalId);
    this.statsCache.dirty = true;
  }

  /**
   * Sets target position for an animal
   */
  public setTargetPosition(
    animalId: string,
    position: { x: number; y: number } | null,
  ): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.targetPosition = position;
    this.markDirty(animalId);
  }

  /**
   * Sets current target for an animal
   */
  public setCurrentTarget(
    animalId: string,
    target: { type: AnimalTargetType; id: string } | null,
  ): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.currentTarget = target;
    this.markDirty(animalId);
  }

  /**
   * Sets flee target for an animal
   */
  public setFleeTarget(animalId: string, targetId: string | null): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    animal.fleeTarget = targetId;
    this.markDirty(animalId);
  }

  /**
   * Marks an animal as dirty (modified)
   */
  public markDirty(animalId: string): void {
    this.dirtyAnimals.add(animalId);
  }

  /**
   * Clears dirty flag for an animal
   */
  public clearDirty(animalId: string): void {
    this.dirtyAnimals.delete(animalId);
  }

  /**
   * Gets all dirty animal IDs
   */
  public getDirtyAnimals(): Set<string> {
    return new Set(this.dirtyAnimals);
  }

  /**
   * Clears all dirty flags
   */
  public clearAllDirty(): void {
    this.dirtyAnimals.clear();
  }

  /**
   * Gets grid cell key for a position
   */
  private getGridCell(position: { x: number; y: number }): string {
    const cellX = Math.floor(position.x / GRID_CELL_SIZE);
    const cellY = Math.floor(position.y / GRID_CELL_SIZE);
    return `${cellX},${cellY}`;
  }

  /**
   * Adds animal to spatial grid
   */
  private addToSpatialGrid(animal: Animal): void {
    const cellKey = this.getGridCell(animal.position);
    let cell = this.spatialGrid.get(cellKey);
    if (!cell) {
      cell = new Set();
      this.spatialGrid.set(cellKey, cell);
    }
    cell.add(animal.id);
  }

  /**
   * Removes animal from spatial grid
   */
  private removeFromSpatialGrid(animal: Animal): void {
    const cellKey = this.getGridCell(animal.position);
    const cell = this.spatialGrid.get(cellKey);
    if (cell) {
      cell.delete(animal.id);
      if (cell.size === 0) {
        this.spatialGrid.delete(cellKey);
      }
    }
  }

  /**
   * Gets animals in radius using spatial grid - O(cells)
   */
  public getAnimalsInRadius(
    x: number,
    y: number,
    radius: number,
    excludeDead: boolean = true,
  ): Animal[] {
    const results: Animal[] = [];
    const radiusSq = radius * radius;

    const minCellX = Math.floor((x - radius) / GRID_CELL_SIZE);
    const maxCellX = Math.floor((x + radius) / GRID_CELL_SIZE);
    const minCellY = Math.floor((y - radius) / GRID_CELL_SIZE);
    const maxCellY = Math.floor((y + radius) / GRID_CELL_SIZE);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.spatialGrid.get(`${cellX},${cellY}`);
        if (!cell) continue;

        for (const animalId of cell) {
          const animal = this.animals.get(animalId);
          if (!animal) continue;
          if (excludeDead && animal.isDead) continue;

          const dx = animal.position.x - x;
          const dy = animal.position.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            results.push(animal);
          }
        }
      }
    }

    return results;
  }

  /**
   * Gets animals by type
   */
  public getAnimalsByType(type: AnimalType): Animal[] {
    return Array.from(this.animals.values()).filter(
      (a) => a.type === type && !a.isDead,
    );
  }

  /**
   * Gets animals in a biome
   */
  public getAnimalsInBiome(biome: string): Animal[] {
    return Array.from(this.animals.values()).filter(
      (a) => a.biome === biome && !a.isDead,
    );
  }

  // ==================== Bulk Access ====================

  /**
   * Gets all animals (iterator for memory efficiency)
   */
  public getAllAnimals(): IterableIterator<Animal> {
    return this.animals.values();
  }

  /**
   * Gets all animal IDs
   */
  public getAllAnimalIds(): string[] {
    return Array.from(this.animals.keys());
  }

  /**
   * Gets all live animals as array
   */
  public getLiveAnimals(): Animal[] {
    return Array.from(this.animals.values()).filter((a) => !a.isDead);
  }

  /**
   * Gets count of registered animals
   */
  public get size(): number {
    return this.animals.size;
  }

  /**
   * Gets the underlying Map (for batch processing compatibility)
   * Prefer using getters/iterators when possible
   */
  public getAnimalsMap(): Map<string, Animal> {
    return this.animals;
  }

  /**
   * Gets statistics about the registry
   */
  public getStats(): {
    total: number;
    alive: number;
    byType: Record<string, number>;
  } {
    if (!this.statsCache.dirty) {
      return {
        total: this.statsCache.total,
        alive: this.statsCache.alive,
        byType: { ...this.statsCache.byType },
      };
    }

    let alive = 0;
    const byType: Record<string, number> = {};

    for (const animal of this.animals.values()) {
      if (!animal.isDead) {
        alive++;
        byType[animal.type] = (byType[animal.type] || 0) + 1;
      }
    }

    this.statsCache = {
      total: this.animals.size,
      alive,
      byType,
      dirty: false,
    };

    return {
      total: this.statsCache.total,
      alive: this.statsCache.alive,
      byType: { ...this.statsCache.byType },
    };
  }

  /**
   * Exports snapshot for gameState (only live animals)
   */
  public exportForGameState(): {
    animals: Animal[];
    stats: { total: number; byType: Record<string, number> };
  } {
    const liveAnimals = this.getLiveAnimals();
    const stats = this.getStats();

    return {
      animals: liveAnimals,
      stats: {
        total: stats.alive,
        byType: stats.byType,
      },
    };
  }

  /**
   * Imports animals from gameState (for loading saves)
   */
  public importFromGameState(animals: Animal[]): void {
    for (const animal of animals) {
      if (!this.animals.has(animal.id)) {
        this.registerAnimal(animal);
      }
    }
    logger.info(
      `🐾 AnimalRegistry: Imported ${animals.length} animals from gameState`,
    );
  }

  /**
   * Removes dead animals and cleans up spatial grid
   */
  public cleanup(now: number = Date.now()): number {
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return 0;
    this.lastCleanup = now;

    let removedCount = 0;
    const toRemove: string[] = [];

    for (const [id, animal] of this.animals) {
      if (animal.isDead) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.removeAnimal(id);
      removedCount++;
    }

    if (removedCount > 0) {
      logger.debug(
        `🐾 AnimalRegistry: Cleaned up ${removedCount} dead animals`,
      );
    }

    return removedCount;
  }

  /**
   * Clears all animals
   */
  public clear(): void {
    this.animals.clear();
    this.spatialGrid.clear();
    this.dirtyAnimals.clear();
    this.statsCache = { total: 0, byType: {}, alive: 0, dirty: true };
    logger.info("🐾 AnimalRegistry: Cleared all animals");
  }
}
