/**
 * SpatialGrid optimizado con TypedArrays para mejor rendimiento
 * Diseñado para procesamiento en batch y fácil migración a GPU
 */
export class OptimizedSpatialGrid<T = string> {
  private cells: Map<string, Set<T>>;
  private entityPositions: Map<T, { x: number; y: number }>;
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;

  // Buffers optimizados para procesamiento batch
  private positionBuffer: Float32Array | null = null;
  private entityIdArray: T[] = [];
  private bufferDirty = true;
  private readonly BATCH_SIZE = 1024;

  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
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

  /**
   * Reconstruye los buffers optimizados desde el estado actual
   */
  private rebuildBuffers(): void {
    const entityCount = this.entityPositions.size;
    if (entityCount === 0) {
      this.positionBuffer = null;
      this.entityIdArray = [];
      this.bufferDirty = false;
      return;
    }

    // Crear arrays con capacidad suficiente
    this.positionBuffer = new Float32Array(entityCount * 2); // x, y por entidad
    this.entityIdArray = new Array(entityCount);

    let index = 0;
    for (const [entity, pos] of this.entityPositions.entries()) {
      this.positionBuffer[index * 2] = pos.x;
      this.positionBuffer[index * 2 + 1] = pos.y;
      this.entityIdArray[index] = entity;
      index++;
    }

    this.bufferDirty = false;
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
    this.bufferDirty = true;
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
    this.bufferDirty = true;
  }

  public clear(): void {
    this.cells.clear();
    this.entityPositions.clear();
    this.positionBuffer = null;
    this.entityIdArray = [];
    this.bufferDirty = true;
  }

  /**
   * Query radius optimizado usando buffers TypedArray
   */
  public queryRadius(
    center: { x: number; y: number },
    radius: number,
  ): Array<{ entity: T; distance: number }> {
    if (this.bufferDirty) {
      this.rebuildBuffers();
    }

    if (!this.positionBuffer || this.entityIdArray.length === 0) {
      return [];
    }

    const results: Array<{ entity: T; distance: number }> = [];
    const radiusSq = radius * radius;
    const centerX = center.x;
    const centerY = center.y;

    // Usar el método tradicional para celdas cercanas (más eficiente para pocas entidades)
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

          const dx = pos.x - centerX;
          const dy = pos.y - centerY;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq <= radiusSq) {
            const distance = Math.sqrt(distanceSq);
            results.push({ entity, distance });
          }
        }
      }
    }

    return results;
  }

  /**
   * Query radius en batch - procesa múltiples queries a la vez
   * Optimizado para cuando hay muchas queries simultáneas
   */
  public queryRadiusBatch(
    queries: Array<{ center: { x: number; y: number }; radius: number }>,
  ): Array<Array<{ entity: T; distance: number }>> {
    if (this.bufferDirty) {
      this.rebuildBuffers();
    }

    if (!this.positionBuffer || this.entityIdArray.length === 0) {
      return queries.map(() => []);
    }

    const results: Array<Array<{ entity: T; distance: number }>> = queries.map(
      () => [],
    );

    // Procesar en batches para evitar sobrecarga de memoria
    for (let batchStart = 0; batchStart < queries.length; batchStart += this.BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + this.BATCH_SIZE, queries.length);
      const batch = queries.slice(batchStart, batchEnd);

      // Para cada query en el batch, usar el método optimizado
      for (let q = 0; q < batch.length; q++) {
        const query = batch[q];
        const queryResults = this.queryRadius(query.center, query.radius);
        results[batchStart + q] = queryResults;
      }
    }

    return results;
  }

  /**
   * Query radius optimizado usando buffers directamente
   * Útil cuando se necesita procesar todas las entidades sin filtrar por celdas
   */
  public queryRadiusBruteForce(
    center: { x: number; y: number },
    radius: number,
  ): Array<{ entity: T; distance: number }> {
    if (this.bufferDirty) {
      this.rebuildBuffers();
    }

    if (!this.positionBuffer || this.entityIdArray.length === 0) {
      return [];
    }

    const results: Array<{ entity: T; distance: number }> = [];
    const radiusSq = radius * radius;
    const centerX = center.x;
    const centerY = center.y;
    const entityCount = this.entityIdArray.length;

    // Procesar en batches para mejor uso de cache
    for (let i = 0; i < entityCount; i++) {
      const x = this.positionBuffer[i * 2];
      const y = this.positionBuffer[i * 2 + 1];
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= radiusSq) {
        const distance = Math.sqrt(distanceSq);
        results.push({
          entity: this.entityIdArray[i],
          distance,
        });
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
    bufferSize: number;
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
      bufferSize: this.positionBuffer?.length ?? 0,
    };
  }

  /**
   * Marca los buffers como dirty (necesitan reconstrucción)
   */
  public markDirty(): void {
    this.bufferDirty = true;
  }

  /**
   * Obtiene el buffer de posiciones (útil para migración a GPU)
   */
  public getPositionBuffer(): Float32Array | null {
    if (this.bufferDirty) {
      this.rebuildBuffers();
    }
    return this.positionBuffer;
  }

  /**
   * Obtiene el array de IDs de entidades (útil para migración a GPU)
   */
  public getEntityIdArray(): T[] {
    if (this.bufferDirty) {
      this.rebuildBuffers();
    }
    return this.entityIdArray;
  }
}

