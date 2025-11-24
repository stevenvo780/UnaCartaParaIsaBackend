import { OptimizedSpatialGrid } from "./OptimizedSpatialGrid";

/**
 * SpatialGrid - Wrapper sobre OptimizedSpatialGrid para compatibilidad
 * Mantiene la misma API pero usa implementación optimizada internamente
 */
export class SpatialGrid<T = string> extends OptimizedSpatialGrid<T> {
  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
    super(worldWidth, worldHeight, cellSize);
  }

  // Todos los métodos están heredados de OptimizedSpatialGrid
  // Se mantiene esta clase para compatibilidad con código existente
}

  public getCell(x: number, y: number): Set<T> | undefined {
    const { col, row } = this.worldToCell(x, y);
    return this.cells.get(this.cellKey(col, row));
  }

  public getStats(): {
    totalEntities: number;
    totalCells: number;
    occupiedCells: number;
    avgEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    let maxEntities = 0;
    for (const cell of this.cells.values()) {
      maxEntities = Math.max(maxEntities, cell.size);
    }

    return {
      totalEntities: this.entityPositions.size,
      totalCells: this.cols * this.rows,
      occupiedCells: this.cells.size,
      avgEntitiesPerCell:
        this.cells.size > 0 ? this.entityPositions.size / this.cells.size : 0,
      maxEntitiesInCell: maxEntities,
    };
  }
}
