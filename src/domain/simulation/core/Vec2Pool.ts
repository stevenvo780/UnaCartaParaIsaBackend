/**
 * Object pool para vectores 2D {x, y}
 * Reduce presión sobre el garbage collector
 */
export class Vec2Pool {
  private pool: Array<{ x: number; y: number }> = [];
  private readonly maxPoolSize = 100;

  /**
   * Adquiere un vector del pool o crea uno nuevo
   */
  public acquire(x: number, y: number): { x: number; y: number } {
    const v = this.pool.pop() || { x: 0, y: 0 };
    v.x = x;
    v.y = y;
    return v;
  }

  /**
   * Libera un vector de vuelta al pool
   */
  public release(v: { x: number; y: number }): void {
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(v);
    }
  }

  /**
   * Limpia el pool
   */
  public clear(): void {
    this.pool = [];
  }

  /**
   * Obtiene el tamaño actual del pool
   */
  public getSize(): number {
    return this.pool.length;
  }
}

// Instancia singleton para uso global
export const vec2Pool = new Vec2Pool();
