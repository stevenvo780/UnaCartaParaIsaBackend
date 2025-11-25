import { SpatialGrid } from "../../../utils/SpatialGrid";
import type { SimulationEntity } from "./schema";
import type { Animal } from "../../types/simulation/animals";

export type EntityType = "agent" | "animal" | "all";

/**
 * Índice espacial compartido para todos los sistemas
 * Elimina reconstrucciones redundantes de spatial grids
 */
export class SharedSpatialIndex {
  private grid: SpatialGrid<string>;
  private entityPositions = new Map<string, { x: number; y: number }>();
  private entityTypes = new Map<string, EntityType>();
  private dirty = true;

  constructor(worldWidth: number, worldHeight: number, cellSize: number = 70) {
    this.grid = new SpatialGrid(worldWidth, worldHeight, cellSize);
  }

  public markDirty(): void {
    this.dirty = true;
  }

  public rebuildIfNeeded(
    entities: SimulationEntity[],
    animals: Map<string, Animal>,
  ): void {
    if (!this.dirty) return;

    this.grid.clear();
    this.entityPositions.clear();
    this.entityTypes.clear();

    for (const entity of entities) {
      if (entity.isDead || !entity.position) continue;
      this.grid.insert(entity.id, entity.position);
      this.entityPositions.set(entity.id, { ...entity.position });
      this.entityTypes.set(entity.id, "agent");
    }

    for (const [animalId, animal] of animals) {
      if (animal.isDead || !animal.position) continue;
      this.grid.insert(animalId, animal.position);
      this.entityPositions.set(animalId, { ...animal.position });
      this.entityTypes.set(animalId, "animal");
    }

    this.dirty = false;
  }

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

  public getPosition(entityId: string): { x: number; y: number } | undefined {
    return this.entityPositions.get(entityId);
  }

  public getType(entityId: string): EntityType | undefined {
    return this.entityTypes.get(entityId);
  }

  public updatePosition(
    entityId: string,
    position: { x: number; y: number },
    type: EntityType = "agent",
  ): void {
    this.grid.insert(entityId, position);
    this.entityPositions.set(entityId, { ...position });
    this.entityTypes.set(entityId, type);
  }

  public remove(entityId: string): void {
    this.grid.remove(entityId);
    this.entityPositions.delete(entityId);
    this.entityTypes.delete(entityId);
  }

  public clear(): void {
    this.grid.clear();
    this.entityPositions.clear();
    this.entityTypes.clear();
    this.dirty = true;
  }

  public isDirty(): boolean {
    return this.dirty;
  }
}
