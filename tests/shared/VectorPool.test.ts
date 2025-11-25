import { describe, it, expect, beforeEach } from "vitest";
import { VectorPool, withTempVector } from "../../src/shared/VectorPool";

describe("VectorPool", () => {
  beforeEach(() => {
    VectorPool.clear();
  });

  it("debe acquire y release vectores con valores específicos", () => {
    const vec = VectorPool.acquire(5, 10);
    expect(vec.x).toBe(5);
    expect(vec.y).toBe(10);

    VectorPool.release(vec);
    const stats = VectorPool.getStats();
    expect(stats.released).toBe(1);
    expect(stats.poolSize).toBeGreaterThan(0);
  });

  it("debe copiar valores entre vectores sin crear nuevos", () => {
    const target = VectorPool.acquire();
    const source = { x: 20, y: 30 };

    VectorPool.copy(target, source);
    expect(target.x).toBe(20);
    expect(target.y).toBe(30);

    VectorPool.release(target);
  });

  it("debe liberar automáticamente al usar withTempVector", () => {
    const statsBefore = VectorPool.getStats();

    withTempVector(1, 2, (vec) => {
      expect(vec.x).toBe(1);
      expect(vec.y).toBe(2);
    });

    const statsAfter = VectorPool.getStats();
    expect(statsAfter.released).toBe(statsBefore.released + 1);
  });

  it("debe limpiar el pool con clear()", () => {
    const vec = VectorPool.acquire();
    VectorPool.release(vec);
    VectorPool.clear();

    const stats = VectorPool.getStats();
    expect(stats.poolSize).toBe(0);
    expect(stats.acquired).toBe(0);
    expect(stats.released).toBe(0);
  });
});

