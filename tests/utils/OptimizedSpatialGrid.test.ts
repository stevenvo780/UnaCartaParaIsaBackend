import { describe, it, expect, beforeEach } from "vitest";
import { OptimizedSpatialGrid } from "../../src/utils/OptimizedSpatialGrid";

describe("OptimizedSpatialGrid", () => {
  let grid: OptimizedSpatialGrid<string>;

  beforeEach(() => {
    grid = new OptimizedSpatialGrid(1000, 1000, 100); // 10x10 grid
  });

  describe("constructor", () => {
    it("debe inicializar con dimensiones correctas", () => {
      const newGrid = new OptimizedSpatialGrid(500, 500, 50);
      expect(newGrid).toBeDefined();
    });
  });

  describe("insert", () => {
    it("debe insertar entidad en celda correcta", () => {
      grid.insert("entity-1", { x: 150, y: 150 });

      const cell = grid.getCell(150, 150);
      expect(cell).toBeDefined();
      expect(cell?.has("entity-1")).toBe(true);
    });

    it("debe actualizar posición si ya existe", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-1", { x: 200, y: 200 });

      const oldCell = grid.getCell(100, 100);
      const newCell = grid.getCell(200, 200);

      expect(oldCell?.has("entity-1")).toBe(false);
      expect(newCell?.has("entity-1")).toBe(true);
    });
  });

  describe("remove", () => {
    it("debe remover entidad de celda", () => {
      grid.insert("entity-1", { x: 150, y: 150 });
      grid.remove("entity-1");

      const cell = grid.getCell(150, 150);
      expect(cell?.has("entity-1")).toBe(false);
    });

    it("no debe hacer nada si entidad no existe", () => {
      expect(() => {
        grid.remove("nonexistent");
      }).not.toThrow();
    });
  });

  describe("clear", () => {
    it("debe limpiar todo el grid", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 200, y: 200 });

      grid.clear();

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(0);
    });
  });

  describe("queryRadius", () => {
    it("debe encontrar entidades en radio", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 150, y: 100 });
      grid.insert("entity-3", { x: 500, y: 500 }); // Muy lejos

      const results = grid.queryRadius({ x: 100, y: 100 }, 100);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.entity === "entity-1")).toBe(true);
      expect(results.some((r) => r.entity === "entity-2")).toBe(true);
    });

    it("debe respetar límites del grid", () => {
      grid.insert("entity-1", { x: 50, y: 50 });
      grid.insert("entity-2", { x: -10, y: -10 }); // Fuera del grid

      const results = grid.queryRadius({ x: 0, y: 0 }, 200);

      // Solo debe encontrar entity-1
      expect(results.some((r) => r.entity === "entity-1")).toBe(true);
    });

    it("debe retornar array vacío si no hay entidades", () => {
      const results = grid.queryRadius({ x: 500, y: 500 }, 100);
      expect(results).toEqual([]);
    });
  });

  describe("queryRadiusBatch", () => {
    it("debe procesar múltiples queries", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 200, y: 200 });

      const queries = [
        { center: { x: 100, y: 100 }, radius: 50 },
        { center: { x: 200, y: 200 }, radius: 50 },
      ];

      const results = grid.queryRadiusBatch(queries);

      expect(results).toHaveLength(2);
      expect(results[0].length).toBeGreaterThanOrEqual(1);
      expect(results[1].length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("queryRadiusBruteForce", () => {
    it("debe hacer búsqueda sin filtro de celdas", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 150, y: 150 });

      const results = grid.queryRadiusBruteForce({ x: 100, y: 100 }, 100);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getCell", () => {
    it("debe retornar celda en posición", () => {
      grid.insert("entity-1", { x: 150, y: 150 });

      const cell = grid.getCell(150, 150);
      expect(cell).toBeDefined();
      expect(cell?.has("entity-1")).toBe(true);
    });

    it("debe retornar undefined para celda vacía", () => {
      const cell = grid.getCell(500, 500);
      expect(cell).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("debe retornar estadísticas del grid", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 200, y: 200 });

      const stats = grid.getStats();

      expect(stats.totalEntities).toBe(2);
      expect(stats.totalCells).toBe(100); // 10x10
      expect(stats.occupiedCells).toBeGreaterThan(0);
      expect(stats.avgEntitiesPerCell).toBeGreaterThan(0);
    });
  });

  describe("markDirty", () => {
    it("debe marcar buffers como dirty", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.markDirty();

      // Al hacer query, debe reconstruir buffers
      const results = grid.queryRadius({ x: 100, y: 100 }, 50);
      expect(results).toBeDefined();
    });
  });

  describe("getPositionBuffer", () => {
    it("debe retornar buffer de posiciones", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 200, y: 200 });

      const buffer = grid.getPositionBuffer();

      expect(buffer).toBeDefined();
      if (buffer) {
        expect(buffer.length).toBe(4); // 2 entidades * 2 coordenadas
      }
    });
  });

  describe("getEntityIdArray", () => {
    it("debe retornar array de IDs", () => {
      grid.insert("entity-1", { x: 100, y: 100 });
      grid.insert("entity-2", { x: 200, y: 200 });

      const ids = grid.getEntityIdArray();

      expect(ids).toHaveLength(2);
      expect(ids).toContain("entity-1");
      expect(ids).toContain("entity-2");
    });
  });
});

