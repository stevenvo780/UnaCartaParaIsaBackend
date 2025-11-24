import { describe, it, expect, beforeEach } from "vitest";
import { VoronoiGenerator } from "../../src/generation/VoronoiGenerator.js";

describe("VoronoiGenerator", () => {
  let generator: VoronoiGenerator;

  beforeEach(() => {
    generator = new VoronoiGenerator(1000, 1000);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(generator).toBeDefined();
    });

    it("debe aceptar seed personalizado", () => {
      const seededGenerator = new VoronoiGenerator(1000, 1000, "test-seed");
      expect(seededGenerator).toBeDefined();
    });
  });

  describe("generateRegions", () => {
    it("debe generar regiones", () => {
      const regions = generator.generateRegions(10);
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });

    it("debe generar el número correcto de regiones", () => {
      const regions = generator.generateRegions(5);
      expect(regions.length).toBe(5);
    });

    it("debe aceptar distancia mínima personalizada", () => {
      const regions = generator.generateRegions(10, 200);
      expect(regions.length).toBe(10);
    });

    it("debe generar regiones con propiedades válidas", () => {
      const regions = generator.generateRegions(5);
      regions.forEach(region => {
        expect(region.id).toBeDefined();
        expect(region.center).toBeDefined();
        expect(region.center.x).toBeGreaterThanOrEqual(0);
        expect(region.center.y).toBeGreaterThanOrEqual(0);
        expect(region.bounds).toBeDefined();
        expect(Array.isArray(region.bounds)).toBe(true);
        expect(region.area).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

