import { SpatialGrid } from "../../../utils/SpatialGrid";
import type { SimulationEntity } from "./schema";
import type { Animal } from "../../types/simulation/animals";
import { injectable } from "inversify";

/**
 * Entity type filter for spatial queries.
 */
export type EntityType = "agent" | "animal" | "all";

/**
 * Shared spatial index for all systems.
 *
 * Provides O(log n) spatial queries using a grid-based spatial hash.
 * Optimized with incremental O(Δn) updates instead of O(n) full rebuilds.
 * Uses object pooling to reduce garbage collection pressure.
 *
 * @see SpatialGrid for the underlying grid implementation
 */
@injectable()
export class SharedSpatialIndex {
  private grid: SpatialGrid<string>;
  private entityPositions = new Map<string, { x: number; y: number }>();
  private entityTypes = new Map<string, EntityType>();
  private dirty = true;

  private lastEntityIds = new Set<string>();
  private lastAnimalIds = new Set<string>();
  private positionCache = new Map<string, { x: number; y: number }>();

  private positionPool: Array<{ x: number; y: number }> = [];
  private readonly POSITION_POOL_SIZE = 200;

  constructor(
    worldWidth: number = 3200,
    worldHeight: number = 3200,
    cellSize: number = 70,
  ) {
    this.grid = new SpatialGrid(worldWidth, worldHeight, cellSize);
    for (let i = 0; i < this.POSITION_POOL_SIZE; i++) {
      this.positionPool.push({ x: 0, y: 0 });
    }
  }

  private acquirePosition(): { x: number; y: number } {
    return this.positionPool.pop() || { x: 0, y: 0 };
  }

  private releasePosition(pos: { x: number; y: number }): void {
    if (this.positionPool.length < this.POSITION_POOL_SIZE) {
      this.positionPool.push(pos);
    }
  }

  /**
   * Marks the index as dirty, forcing a full rebuild on next rebuildIfNeeded call.
   */
  public markDirty(): void {
    this.dirty = true;
  }

  /**
   * Rebuilds the spatial index if dirty, otherwise updates only moved positions.
   * Optimized: incremental update - only processes changes.
   *
   * @param entities - List of simulation entities to index
   * @param animals - Map of animals to index
   */
  public rebuildIfNeeded(
    entities: SimulationEntity[],
    animals: Map<string, Animal>,
  ): void {
    if (!this.dirty) {
      this.updateMovedPositions(entities, animals);
      return;
    }

    const currentEntityIds = new Set<string>();
    const currentAnimalIds = new Set<string>();

    for (const entity of entities) {
      if (entity.isDead || !entity.position) continue;

      currentEntityIds.add(entity.id);
      const lastPos = this.positionCache.get(entity.id);

      if (
        !lastPos ||
        Math.abs(lastPos.x - entity.position.x) > 1 ||
        Math.abs(lastPos.y - entity.position.y) > 1
      ) {
        this.updateEntityPosition(entity.id, entity.position, "agent");
      }
    }

    for (const [animalId, animal] of animals) {
      if (animal.isDead || !animal.position) continue;

      currentAnimalIds.add(animalId);
      const lastPos = this.positionCache.get(animalId);

      if (
        !lastPos ||
        Math.abs(lastPos.x - animal.position.x) > 1 ||
        Math.abs(lastPos.y - animal.position.y) > 1
      ) {
        this.updateEntityPosition(animalId, animal.position, "animal");
      }
    }

    for (const id of this.lastEntityIds) {
      if (!currentEntityIds.has(id)) {
        this.removeEntity(id);
      }
    }

    for (const id of this.lastAnimalIds) {
      if (!currentAnimalIds.has(id)) {
        this.removeEntity(id);
      }
    }

    this.lastEntityIds = currentEntityIds;
    this.lastAnimalIds = currentAnimalIds;
    this.dirty = false;
  }

  private updateMovedPositions(
    entities: SimulationEntity[],
    animals: Map<string, Animal>,
  ): void {
    // === OPTIMIZATION: Only check entities that are likely to have moved ===
    // Skip position check if difference is < 2 pixels (rounding errors)
    const MOVE_THRESHOLD_SQ = 4; // 2 pixels squared

    for (const entity of entities) {
      if (entity.isDead || !entity.position) continue;

      const cached = this.positionCache.get(entity.id);
      if (cached) {
        const dx = cached.x - entity.position.x;
        const dy = cached.y - entity.position.y;
        if (dx * dx + dy * dy > MOVE_THRESHOLD_SQ) {
          this.updateEntityPosition(entity.id, entity.position, "agent");
        }
      }
    }

    // === OPTIMIZATION: Sample animals instead of checking all ===
    // For 1000+ animals, only check a subset per frame
    const animalArray = Array.from(animals.entries());
    const checkLimit = Math.min(animalArray.length, 200); // Max 200 animals per frame
    const startIdx = (Date.now() % 100) * Math.floor(animalArray.length / 100);

    for (let i = 0; i < checkLimit; i++) {
      const idx = (startIdx + i) % animalArray.length;
      const [animalId, animal] = animalArray[idx];

      if (animal.isDead || !animal.position) continue;

      const cached = this.positionCache.get(animalId);
      if (cached) {
        const dx = cached.x - animal.position.x;
        const dy = cached.y - animal.position.y;
        if (dx * dx + dy * dy > MOVE_THRESHOLD_SQ) {
          this.updateEntityPosition(animalId, animal.position, "animal");
        }
      }
    }
  }

  private updateEntityPosition(
    id: string,
    position: { x: number; y: number },
    type: EntityType,
  ): void {
    this.grid.insert(id, position);

    let cached = this.entityPositions.get(id);
    if (cached) {
      cached.x = position.x;
      cached.y = position.y;
    } else {
      cached = this.acquirePosition();
      cached.x = position.x;
      cached.y = position.y;
      this.entityPositions.set(id, cached);
    }

    const posCache = this.positionCache.get(id);
    if (posCache) {
      posCache.x = position.x;
      posCache.y = position.y;
    } else {
      this.positionCache.set(id, { x: position.x, y: position.y });
    }

    this.entityTypes.set(id, type);
  }

  private removeEntity(id: string): void {
    this.grid.remove(id);
    const pos = this.entityPositions.get(id);
    if (pos) {
      this.releasePosition(pos);
      this.entityPositions.delete(id);
    }
    this.positionCache.delete(id);
    this.entityTypes.delete(id);
  }

  /**
   * Queries entities within a radius of a position.
   *
   * @param position - Center position for the query
   * @param radius - Query radius in world units
   * @param filter - Optional entity type filter ("agent", "animal", or "all")
   * @returns Array of results with entity ID, distance, and type
   */
  public queryRadius(
    position: { x: number; y: number },
    radius: number,
    filter?: EntityType,
  ): Array<{ entity: string; distance: number; type: EntityType }> {
    const results = this.grid.queryRadius(position, radius);

    if (!filter || filter === "all") {
      return results.map((r) => ({
        entity: r.entity,
        distance: r.distance,
        type: this.entityTypes.get(r.entity) || "agent",
      }));
    }

    return results
      .filter((r) => {
        const type = this.entityTypes.get(r.entity);
        return type === filter;
      })
      .map((r) => ({
        entity: r.entity,
        distance: r.distance,
        type: this.entityTypes.get(r.entity) || "agent",
      }));
  }

  /**
   * Gets the cached position of an entity.
   *
   * @param entityId - Entity identifier
   * @returns Position or undefined if not found
   */
  public getPosition(entityId: string): { x: number; y: number } | undefined {
    return this.entityPositions.get(entityId);
  }

  /**
   * Gets the type of an entity.
   *
   * @param entityId - Entity identifier
   * @returns Entity type or undefined if not found
   */
  public getType(entityId: string): EntityType | undefined {
    return this.entityTypes.get(entityId);
  }

  /**
   * Updates an entity's position in the index.
   *
   * @param entityId - Entity identifier
   * @param position - New position
   * @param type - Entity type (defaults to "agent")
   */
  public updatePosition(
    entityId: string,
    position: { x: number; y: number },
    type: EntityType = "agent",
  ): void {
    this.grid.insert(entityId, position);
    this.entityPositions.set(entityId, { ...position });
    this.entityTypes.set(entityId, type);
  }

  /**
   * Removes an entity from the index.
   *
   * @param entityId - Entity identifier to remove
   */
  public remove(entityId: string): void {
    this.grid.remove(entityId);
    this.entityPositions.delete(entityId);
    this.entityTypes.delete(entityId);
  }

  /**
   * Clears the entire index.
   */
  public clear(): void {
    this.grid.clear();
    this.entityPositions.clear();
    this.entityTypes.clear();
    this.dirty = true;
  }

  /**
   * Checks if the index is dirty and needs rebuilding.
   *
   * @returns True if dirty
   */
  public isDirty(): boolean {
    return this.dirty;
  }
}
