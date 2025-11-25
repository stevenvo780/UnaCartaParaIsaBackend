import { describe, it, expect, beforeEach } from "vitest";
import { Vec2Pool, vec2Pool } from "../../src/domain/simulation/core/Vec2Pool";

describe("Vec2Pool", () => {
  let pool: Vec2Pool;

  beforeEach(() => {
    pool = new Vec2Pool();
  });

  describe("acquire", () => {
    it("debe retornar vector con valores correctos", () => {
      const v = pool.acquire(10, 20);

      expect(v.x).toBe(10);
      expect(v.y).toBe(20);
    });

    it("debe reutilizar vectores del pool", () => {
      const v1 = pool.acquire(10, 20);
      pool.release(v1);

      const v2 = pool.acquire(30, 40);

      // Debe reutilizar el mismo objeto
      expect(v2).toBe(v1);
      expect(v2.x).toBe(30);
      expect(v2.y).toBe(40);
    });

    it("debe crear nuevo vector si pool vacío", () => {
      const v = pool.acquire(10, 20);

      expect(v).toBeDefined();
      expect(v.x).toBe(10);
      expect(v.y).toBe(20);
    });
  });

  describe("release", () => {
    it("debe devolver vector al pool", () => {
      const v = pool.acquire(10, 20);
      pool.release(v);

      expect(pool.getSize()).toBe(1);
    });

    it("no debe exceder maxPoolSize", () => {
      const vectors: Array<{ x: number; y: number }> = [];

      // Crear más de maxPoolSize (100) vectores
      for (let i = 0; i < 150; i++) {
        const v = pool.acquire(i, i);
        vectors.push(v);
      }

      // Liberar todos
      vectors.forEach((v) => pool.release(v));

      // El pool no debe exceder maxPoolSize
      expect(pool.getSize()).toBeLessThanOrEqual(100);
    });
  });

  describe("clear", () => {
    it("debe vaciar el pool", () => {
      const v1 = pool.acquire(10, 20);
      const v2 = pool.acquire(30, 40);
      pool.release(v1);
      pool.release(v2);

      expect(pool.getSize()).toBe(2);

      pool.clear();

      expect(pool.getSize()).toBe(0);
    });
  });

  describe("getSize", () => {
    it("debe retornar tamaño actual", () => {
      expect(pool.getSize()).toBe(0);

      const v1 = pool.acquire(10, 20);
      pool.release(v1);

      expect(pool.getSize()).toBe(1);
    });
  });

  describe("vec2Pool singleton", () => {
    it("debe exportar instancia singleton", () => {
      expect(vec2Pool).toBeDefined();
      expect(vec2Pool).toBeInstanceOf(Vec2Pool);
    });
  });
});

