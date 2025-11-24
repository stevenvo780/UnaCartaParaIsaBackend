import { SpatialGrid } from "../../../utils/SpatialGrid";
import type { SimulationEntity } from "./schema";
import type { Animal } from "../../types/simulation/animals";
import type { GameState } from "../../types/game-types";

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
  private readonly cellSize: number;

  constructor(worldWidth: number, worldHeight: number, cellSize: number = 70) {
    this.cellSize = cellSize;
    this.grid = new SpatialGrid(worldWidth, worldHeight, cellSize);
  }

  /**
   * Marca el índice como dirty (necesita reconstrucción)
   */
  public markDirty(): void {
    this.dirty = true;
  }

  /**
   * Reconstruye el índice si es necesario
   */
  public rebuildIfNeeded(
    entities: SimulationEntity[],
    animals: Map<string, Animal>,
  ): void {
    if (!this.dirty) return;

    this.grid.clear();
    this.entityPositions.clear();
    this.entityTypes.clear();

    // Indexar entidades
    for (const entity of entities) {
      if (entity.isDead || !entity.position) continue;
      this.grid.insert(entity.id, entity.position);
      this.entityPositions.set(entity.id, { ...entity.position });
      this.entityTypes.set(entity.id, "agent");
    }

    // Indexar animales
    for (const [animalId, animal] of animals) {
      if (animal.isDead || !animal.position) continue;
      this.grid.insert(animalId, animal.position);
      this.entityPositions.set(animalId, { ...animal.position });
      this.entityTypes.set(animalId, "animal");
    }

    this.dirty = false;
  }

  /**
   * Consulta entidades en un radio
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
   * Obtiene la posición de una entidad
   */
  public getPosition(entityId: string): { x: number; y: number } | undefined {
    return this.entityPositions.get(entityId);
  }

  /**
   * Obtiene el tipo de una entidad
   */
  public getType(entityId: string): EntityType | undefined {
    return this.entityTypes.get(entityId);
  }

  /**
   * Actualiza la posición de una entidad
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
   * Elimina una entidad del índice
   */
  public remove(entityId: string): void {
    this.grid.remove(entityId);
    this.entityPositions.delete(entityId);
    this.entityTypes.delete(entityId);
  }

  /**
   * Limpia el índice completamente
   */
  public clear(): void {
    this.grid.clear();
    this.entityPositions.clear();
    this.entityTypes.clear();
    this.dirty = true;
  }

  /**
   * Verifica si el índice está dirty
   */
  public isDirty(): boolean {
    return this.dirty;
  }
}
