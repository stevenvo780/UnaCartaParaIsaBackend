import { BiomeType } from "./types";
import { SIMPLE_BIOMES, SimpleBiomeConfig } from "./SimpleBiomeDefinitions";
import { logger } from "@/infrastructure/utils/logger";

/**
 * BiomeResolver — resolves terrain biome from environmental factors.
 *
 * Inputs: temperature, moisture, elevation, continentality
 * Strategy:
 * - Oceans on low continentality
 * - Lakes on low elevation + moderate moisture (thresholds relaxed)
 * - Forced initial lake to guarantee survival in early tiles if no water yet
 * - Otherwise selects best-fit walkable biome using centered range scoring
 */
export class BiomeResolver {
  private biomes: SimpleBiomeConfig[];
  private waterBiomesGenerated = 0;

  constructor() {
    this.biomes = SIMPLE_BIOMES;
  }

  /**
   * Reset internal state for deterministic chunk generation.
   * Call this before generating a new chunk to ensure consistent results.
   */
  public reset(): void {
    this.waterBiomesGenerated = 0;
  }

  /**
   * Resolve biome based on environmental factors.
   * Uses realistic thresholds (Perlin noise centered around 0.5).
   *
   * WATER GENERATION STRATEGY:
   * - OCEAN: continentality < 0.35 (expanded from 0.30)
   * - LAKE: elevation < 0.48 && moisture > 0.50 (relaxed thresholds)
   * - Guaranteed first water: force a LAKE if none generated and elevation < 0.52
   *
   * @param temperature - Normalized temperature [0..1]
   * @param moisture - Normalized moisture [0..1]
   * @param elevation - Normalized elevation [0..1]
   * @param continentality - Normalized inlandness [0..1]
   * @returns Resolved biome type
   */
  public resolveBiome(
    temperature: number,
    moisture: number,
    elevation: number,
    continentality: number,
  ): BiomeType {
    if (continentality < 0.35) {
      this.waterBiomesGenerated++;
      logger.debug(
        `🌊 [BiomeResolver] OCEAN generated (cont=${continentality.toFixed(3)})`,
      );
      return BiomeType.OCEAN;
    }

    if (elevation < 0.48 && moisture > 0.5) {
      this.waterBiomesGenerated++;
      logger.debug(
        `🏞️ [BiomeResolver] LAKE generated (elev=${elevation.toFixed(3)}, moist=${moisture.toFixed(3)})`,
      );
      return BiomeType.LAKE;
    }

    // Note: Removed forced first LAKE logic for deterministic chunk generation
    // The relaxed LAKE thresholds (elevation < 0.48 && moisture > 0.5) should be sufficient

    if (elevation < 0.5 && moisture > 0.55) {
      return BiomeType.WETLAND;
    }

    if (continentality < 0.42 && elevation < 0.42) {
      return BiomeType.BEACH;
    }

    const candidates = this.biomes.filter(
      (b) =>
        b.isWalkable &&
        this.matchesCriteria(b, temperature, moisture, elevation),
    );

    if (candidates.length === 0) {
      const result = this.findClosestBiome(temperature, moisture, elevation);
      return result;
    }

    if (candidates.length === 1) {
      return candidates[0].id;
    }

    const result = this.getBestFit(
      candidates,
      temperature,
      moisture,
      elevation,
    );

    return result;
  }

  private matchesCriteria(
    biome: SimpleBiomeConfig,
    temp: number,
    moist: number,
    elev: number,
  ): boolean {
    return (
      temp >= biome.temperature[0] &&
      temp <= biome.temperature[1] &&
      moist >= biome.moisture[0] &&
      moist <= biome.moisture[1] &&
      elev >= biome.elevation[0] &&
      elev <= biome.elevation[1]
    );
  }

  private getBestFit(
    candidates: SimpleBiomeConfig[],
    temp: number,
    moist: number,
    elev: number,
  ): BiomeType {
    let bestBiome = candidates[0];
    let bestScore = -1;

    for (const biome of candidates) {
      const score = this.calculateScore(biome, temp, moist, elev);
      if (score > bestScore) {
        bestScore = score;
        bestBiome = biome;
      }
    }

    return bestBiome.id;
  }

  private calculateScore(
    biome: SimpleBiomeConfig,
    temp: number,
    moist: number,
    elev: number,
  ): number {
    const tempCenter = (biome.temperature[0] + biome.temperature[1]) / 2;
    const moistCenter = (biome.moisture[0] + biome.moisture[1]) / 2;
    const elevCenter = (biome.elevation[0] + biome.elevation[1]) / 2;

    const tempDist = Math.abs(temp - tempCenter);
    const moistDist = Math.abs(moist - moistCenter);
    const elevDist = Math.abs(elev - elevCenter);

    return 1 - (tempDist + moistDist + elevDist) / 3;
  }

  private findClosestBiome(
    temp: number,
    moist: number,
    elev: number,
  ): BiomeType {
    let bestBiome = this.biomes[0];
    let minDistance = Infinity;

    for (const biome of this.biomes) {
      if (!biome.isWalkable) continue;

      const tempCenter = (biome.temperature[0] + biome.temperature[1]) / 2;
      const moistCenter = (biome.moisture[0] + biome.moisture[1]) / 2;
      const elevCenter = (biome.elevation[0] + biome.elevation[1]) / 2;

      const dist =
        Math.pow(temp - tempCenter, 2) +
        Math.pow(moist - moistCenter, 2) +
        Math.pow(elev - elevCenter, 2);

      if (dist < minDistance) {
        minDistance = dist;
        bestBiome = biome;
      }
    }

    return bestBiome.id;
  }
}
