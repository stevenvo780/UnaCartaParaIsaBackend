export class SpatialGrid<T> {
  private grid: Map<string, Set<{ item: T; x: number; y: number }>> = new Map();
  private cellSize: number;

  constructor(_width: number, _height: number, cellSize: number) {
    // width and height parameters kept for API compatibility but not currently used
    // They may be used in the future for bounds checking
    void _width;
    void _height;
    this.cellSize = cellSize;
  }

  private getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  public insert(item: T, x: number, y: number): void {
    const key = this.getKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key)!.add({ item, x, y });
  }

  public clear(): void {
    this.grid.clear();
  }

  public queryRadius(center: { x: number; y: number }, radius: number): { item: T; distance: number }[] {
    const results: { item: T; distance: number }[] = [];
    const startX = Math.floor((center.x - radius) / this.cellSize);
    const endX = Math.floor((center.x + radius) / this.cellSize);
    const startY = Math.floor((center.y - radius) / this.cellSize);
    const endY = Math.floor((center.y + radius) / this.cellSize);

    const r2 = radius * radius;

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const entry of Array.from(cell)) {
            const dx = entry.x - center.x;
            const dy = entry.y - center.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= r2) {
              results.push({ item: entry.item, distance: Math.sqrt(dist2) });
            }
          }
        }
      }
    }

    return results;
  }
}
