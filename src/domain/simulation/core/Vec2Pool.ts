/**
 * Object pool para vectores 2D {x, y}
 * Reduce presión sobre el garbage collector
 */
export class Vec2Pool {
  private pool: Array<{ x: number; y: number }> = [];
  private readonly maxPoolSize = 100;

  public acquire(x: number, y: number): { x: number; y: number } {
    const v = this.pool.pop() || { x: 0, y: 0 };
    v.x = x;
    v.y = y;
    return v;
  }

  public release(v: { x: number; y: number }): void {
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(v);
    }
  }

  public clear(): void {
    this.pool = [];
  }

  public getSize(): number {
    return this.pool.length;
  }
}

export const vec2Pool = new Vec2Pool();
