import { describe, it, expect, beforeEach } from "vitest";
import { BiomeResolver } from "../../src/domain/simulation/systems/world/generation/BiomeResolver.ts";
import { BiomeType } from "../../src/domain/simulation/systems/world/generation/types.ts";

describe("BiomeResolver", () => {
  let resolver: BiomeResolver;

  beforeEach(() => {
    resolver = new BiomeResolver();
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(resolver).toBeDefined();
    });
  });

  describe("resolveBiome", () => {
    it("debe resolver océano para continentality baja", () => {
      // continentality < 0.30 = OCEAN
      const biome = resolver.resolveBiome(0.5, 0.5, 0.5, 0.25);
      expect(biome).toBe(BiomeType.OCEAN);
    });

    it("debe resolver playa para continentality y elevación bajas", () => {
      // continentality < 0.40 && elevation < 0.40 = BEACH
      // pero no puede ser OCEAN (continentality >= 0.30)
      const biome = resolver.resolveBiome(0.5, 0.5, 0.35, 0.35);
      expect(biome).toBe(BiomeType.BEACH);
    });

    it("debe resolver lago para elevación baja y humedad alta", () => {
      // elevation < 0.45 && moisture > 0.52 = LAKE
      const biome = resolver.resolveBiome(0.5, 0.55, 0.40, 0.50);
      expect(biome).toBe(BiomeType.LAKE);
    });

    it("debe resolver bioma basado en temperatura, humedad y elevación", () => {
      const biome = resolver.resolveBiome(0.5, 0.5, 0.5, 0.6);
      expect(biome).toBeDefined();
      expect(Object.values(BiomeType)).toContain(biome);
    });

    it("debe resolver bioma para diferentes condiciones", () => {
      const biome1 = resolver.resolveBiome(0.8, 0.2, 0.5, 0.6); // Caliente y seco
      const biome2 = resolver.resolveBiome(0.2, 0.8, 0.5, 0.6); // Frío y húmedo
      expect(biome1).toBeDefined();
      expect(biome2).toBeDefined();
    });

    it("debe manejar valores extremos", () => {
      const biome1 = resolver.resolveBiome(0.0, 0.0, 0.0, 0.6);
      const biome2 = resolver.resolveBiome(1.0, 1.0, 1.0, 0.6);
      expect(biome1).toBeDefined();
      expect(biome2).toBeDefined();
    });
  });
});

