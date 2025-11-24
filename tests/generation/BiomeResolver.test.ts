import { describe, it, expect, beforeEach } from "vitest";
import { BiomeResolver } from "../../src/generation/BiomeResolver.ts";
import { BiomeType } from "../../src/generation/types.ts";

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
      const biome = resolver.resolveBiome(0.5, 0.5, 0.5, 0.3);
      expect(biome).toBe(BiomeType.OCEAN);
    });

    it("debe resolver playa para continentality y elevación bajas", () => {
      const biome = resolver.resolveBiome(0.5, 0.5, 0.3, 0.45);
      expect(biome).toBe(BiomeType.BEACH);
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

