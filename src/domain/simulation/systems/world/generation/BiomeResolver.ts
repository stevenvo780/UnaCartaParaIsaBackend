import { BiomeType } from "./types";
import { SIMPLE_BIOMES, SimpleBiomeConfig } from "./SimpleBiomeDefinitions";

export class BiomeResolver {
  private biomes: SimpleBiomeConfig[];

  constructor() {
    this.biomes = SIMPLE_BIOMES;
  }

  public resolveBiome(
    temperature: number,
    moisture: number,
    elevation: number,
    continentality: number,
    worldX?: number,
    worldY?: number,
    worldWidth?: number,
    worldHeight?: number,
  ): BiomeType {

    if (worldX !== undefined && worldY !== undefined && 
        worldWidth !== undefined && worldHeight !== undefined) {
      const edgeDistX = Math.min(worldX, worldWidth - worldX);
      const edgeDistY = Math.min(worldY, worldHeight - worldY);
      const edgeDist = Math.min(edgeDistX, edgeDistY);
      

      if (edgeDist < 5) {
        return BiomeType.OCEAN;
      }
      

      if (edgeDist < 10 && elevation < 0.4) {
        return BiomeType.BEACH;
      }
    }


    if (continentality < 0.35) {
      return BiomeType.OCEAN;
    }



    if (elevation < 0.45 && moisture > 0.52 && continentality < 0.55) {
      return BiomeType.LAKE;
    }


    if (continentality < 0.45 && elevation < 0.4) {
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
