/**
 * Object Pool para vectores de posición {x, y}
 *
 * Evita la creación excesiva de objetos durante el game loop.
 * Los objetos se reutilizan en lugar de crear nuevos cada frame.
 *
 * Uso:
 *   const pos = VectorPool.acquire();
 *   pos.x = 100; pos.y = 200;
 *   // ... usar pos ...
 *   VectorPool.release(pos);
 *
 * O con acquire inicializado:
 *   const pos = VectorPool.acquire(100, 200);
 */

export interface PooledVector {
  x: number;
  y: number;
  _pooled?: boolean; // Marca interna para tracking
}

class VectorPoolImpl {
  private pool: PooledVector[] = [];
  private readonly maxSize: number;
  private acquired = 0;
  private released = 0;

  constructor(initialSize = 100, maxSize = 1000) {
    this.maxSize = maxSize;
    // Pre-allocar objetos
    for (let i = 0; i < initialSize; i++) {
      this.pool.push({ x: 0, y: 0, _pooled: true });
    }
  }

  /**
   * Obtiene un vector del pool (o crea uno nuevo si está vacío)
   */
  acquire(x = 0, y = 0): PooledVector {
    this.acquired++;
    let vec: PooledVector;

    if (this.pool.length > 0) {
      vec = this.pool.pop()!;
    } else {
      vec = { x: 0, y: 0, _pooled: true };
    }

    vec.x = x;
    vec.y = y;
    return vec;
  }

  /**
   * Devuelve un vector al pool para reutilización
   */
  release(vec: PooledVector): void {
    if (!vec || !vec._pooled) return; // Solo reciclar objetos pooled

    this.released++;

    if (this.pool.length < this.maxSize) {
      vec.x = 0;
      vec.y = 0;
      this.pool.push(vec);
    }
    // Si el pool está lleno, simplemente dejamos que el GC lo recoja
  }

  /**
   * Copia valores de un vector a otro (evita crear nuevo objeto)
   */
  copy(target: PooledVector, source: { x: number; y: number }): PooledVector {
    target.x = source.x;
    target.y = source.y;
    return target;
  }

  /**
   * Crea un vector temporal para cálculos (se debe liberar después)
   */
  temp(x = 0, y = 0): PooledVector {
    return this.acquire(x, y);
  }

  /**
   * Estadísticas del pool para debugging
   */
  getStats(): { poolSize: number; acquired: number; released: number } {
    return {
      poolSize: this.pool.length,
      acquired: this.acquired,
      released: this.released,
    };
  }

  /**
   * Limpia el pool (útil para tests)
   */
  clear(): void {
    this.pool = [];
    this.acquired = 0;
    this.released = 0;
  }
}

// Singleton exportado
export const VectorPool = new VectorPoolImpl();

/**
 * Helper para usar vectores temporales en un scope
 * El vector se libera automáticamente al final del callback
 */
export function withTempVector<T>(
  x: number,
  y: number,
  fn: (vec: PooledVector) => T,
): T {
  const vec = VectorPool.acquire(x, y);
  try {
    return fn(vec);
  } finally {
    VectorPool.release(vec);
  }
}
