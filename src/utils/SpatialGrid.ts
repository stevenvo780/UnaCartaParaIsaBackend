export class SpatialGrid<T = string> {
  private cells: Map<string, Set<T>>;
  private entityPositions: Map<T, { x: number; y: number }>;
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;

  constructor(
    worldWidth: number,
    worldHeight: number,
    cellSize: number,
  ) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.cells = new Map();
    this.entityPositions = new Map();
  }

  private worldToCell(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / this.cellSize),
      row: Math.floor(y / this.cellSize),
    };
  }

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  public insert(entity: T, position: { x: number; y: number }): void {
    this.remove(entity);

    const { col, row } = this.worldToCell(position.x, position.y);
    const key = this.cellKey(col, row);

    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }

    this.cells.get(key)!.add(entity);
    this.entityPositions.set(entity, { ...position });
  }

  public remove(entity: T): void {
    const pos = this.entityPositions.get(entity);
    if (!pos) return;

    const { col, row } = this.worldToCell(pos.x, pos.y);
    const key = this.cellKey(col, row);
    const cell = this.cells.get(key);

    if (cell) {
      cell.delete(entity);
      if (cell.size === 0) {
        this.cells.delete(key);
      }
    }

    this.entityPositions.delete(entity);
  }

  public clear(): void {
    this.cells.clear();
    this.entityPositions.clear();
  }

  public queryRadius(
    center: { x: number; y: number },
    radius: number,
  ): Array<{ entity: T; distance: number }> {
    const results: Array<{ entity: T; distance: number }> = [];
    const { col: centerCol, row: centerRow } = this.worldToCell(
      center.x,
      center.y,
    );
    const cellRadius = Math.ceil(radius / this.cellSize);

    for (
      let col = centerCol - cellRadius;
      col <= centerCol + cellRadius;
      col++
    ) {
      for (
        let row = centerRow - cellRadius;
        row <= centerRow + cellRadius;
        row++
      ) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
          continue;
        }

        const key = this.cellKey(col, row);
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const entity of cell) {
          const pos = this.entityPositions.get(entity);
          if (!pos) continue;

          const dx = pos.x - center.x;
          const dy = pos.y - center.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= radius) {
            results.push({ entity, distance });
          }
        }
      }
    }

    return results;
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
