import { NoiseUtils } from "../../../../../shared/utils/NoiseUtils";
import { BiomeResolver } from "./BiomeResolver";
import { WorldGenConfig, TerrainTile, BiomeType } from "./types";
import { SIMPLE_BIOMES, SimpleBiomeConfig } from "./SimpleBiomeDefinitions";
import seedrandom from "seedrandom";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../../config/Types";
import { VoronoiGenerator } from "./VoronoiGenerator";
import { WorldGenerationStatus } from "../../../../../shared/constants/StatusEnums";
import { logger } from "../../../../../infrastructure/utils/logger";

/**
 * Service for generating world terrain chunks.
 *
 * Uses noise-based generation with biome resolution based on temperature,
 * moisture, elevation, and continentality values.
 *
 * @see BiomeResolver for biome determination logic
 * @see VoronoiGenerator for Voronoi-based world generation
 */
@injectable()
export class WorldGenerationService {
  private noiseGen: NoiseUtils;
  private biomeResolver: BiomeResolver;
  private biomeMap: Map<BiomeType, SimpleBiomeConfig>;
  private currentSeed: string | number = "default";

  constructor(
    @inject(TYPES.VoronoiGenerator) private voronoiGenerator: VoronoiGenerator,
  ) {
    this.noiseGen = new NoiseUtils();
    this.biomeResolver = new BiomeResolver();
    this.biomeMap = new Map(SIMPLE_BIOMES.map((b) => [b.id, b]));
  }

  private initializeGenerators(config: WorldGenConfig): void {
    const seed = config.seed ?? "default";
    if (this.currentSeed === seed && this.noiseGen) {
      return;
    }
    this.currentSeed = seed;
    this.noiseGen = new NoiseUtils(this.currentSeed);
    if (config.width <= 0 || config.height <= 0) {
      throw new Error("World generation config dimensions must be positive");
    }
  }

  /**
   * Generates a 16x16 terrain chunk at the specified coordinates.
   *
   * Uses Perlin noise to generate temperature, moisture, elevation, and continentality values.
   * Resolves biomes based on these values and generates appropriate assets.
   *
   * @param x - Chunk X coordinate (in chunk units, not pixels)
   * @param y - Chunk Y coordinate (in chunk units, not pixels)
   * @param config - World generation configuration (seed, dimensions, noise parameters)
   * @returns Promise resolving to a 2D array of terrain tiles (16x16)
   *
   * @remarks
   * This method is deterministic when the same seed is used. Chunk generation
   * is CPU-intensive and should be cached when possible.
   */
  async generateChunk(
    x: number,
    y: number,
    config: WorldGenConfig,
  ): Promise<TerrainTile[][]> {
    this.initializeGenerators(config);

    const tiles: TerrainTile[][] = [];
    const chunkSize = 16;

    for (let i = 0; i < chunkSize; i++) {
      const row: TerrainTile[] = [];
      for (let j = 0; j < chunkSize; j++) {
        const globalX = x * chunkSize + j;
        const globalY = y * chunkSize + i;

        const temperature = this.noiseGen.noise2D(
          globalX * 0.015,
          globalY * 0.015,
        );
        const moisture = this.noiseGen.noise2D(
          globalX * 0.02 + 1000,
          globalY * 0.02 + 1000,
        );
        const elevation = this.noiseGen.noise2D(
          globalX * 0.025 + 2000,
          globalY * 0.025 + 2000,
        );

        const continentality = this.noiseGen.noise2D(
          globalX * 0.008,
          globalY * 0.008,
        );

        if (globalX < 3 && globalY < 3) {
          logger.debug(
            `[DEBUG BiomeGen] (${globalX},${globalY}): cont=${((continentality + 1) / 2).toFixed(3)}, elev=${((elevation + 1) / 2).toFixed(3)}, moist=${((moisture + 1) / 2).toFixed(3)}`,
          );
        }

        const distFromSpawnCenter = Math.hypot(globalX - 6, globalY - 6);
        let biome: BiomeType;
        if (distFromSpawnCenter < 2.5) {
          biome = BiomeType.LAKE;
          logger.debug(
            `[OASIS] Forced LAKE at (${globalX}, ${globalY}) dist=${distFromSpawnCenter.toFixed(2)}`,
          );
        } else {
          biome = this.biomeResolver.resolveBiome(
            (temperature + 1) / 2,
            (moisture + 1) / 2,
            (elevation + 1) / 2,
            (continentality + 1) / 2,
          );
        }

        const biomeConfig = this.biomeMap.get(biome);
        const assets = this.generateAssetsForTile(
          biomeConfig,
          globalX,
          globalY,
        );

        row.push({
          x: globalX,
          y: globalY,
          biome,
          biomeStrength: 1,
          temperature,
          moisture,
          elevation,
          isWalkable: biome !== BiomeType.OCEAN && biome !== BiomeType.LAKE,
          assets: {
            terrain: `terrain_${biome}`,
            ...assets,
          },
        });
      }
      tiles.push(row);
    }

    return tiles;
  }

  /**
   * Generates assets (vegetation, props, structures) for a terrain tile.
   * Uses seeded random number generation based on tile coordinates to ensure
   * deterministic asset placement. Applies biome density and clustering rules.
   */
  private generateAssetsForTile(
    biomeConfig: SimpleBiomeConfig | undefined,
    x: number,
    y: number,
  ): {
    vegetation: string[];
    props: string[];
    structures: string[];
    decals: string[];
  } {
    const assets = {
      vegetation: [] as string[],
      props: [] as string[],
      structures: [] as string[],
      decals: [] as string[],
    };

    if (!biomeConfig) return assets;

    const tileRng = seedrandom(`${x},${y}-${this.currentSeed}`);

    if (
      biomeConfig.density.trees &&
      tileRng() < biomeConfig.density.trees * 0.4
    ) {
      const clusterNoise = this.noiseGen.noise2D(x * 0.05, y * 0.05);
      if (clusterNoise > 0.5 - (biomeConfig.clustering || 0.5)) {
        assets.vegetation.push(`tree_${biomeConfig.id}`);
      }
    }

    if (
      biomeConfig.density.plants &&
      tileRng() < biomeConfig.density.plants * 0.2
    ) {
      assets.vegetation.push(`plant_${biomeConfig.id}`);
    }

    if (
      biomeConfig.density.props &&
      tileRng() < biomeConfig.density.props * 0.4
    ) {
      assets.decals.push(`decal_${biomeConfig.id}`);
      if (tileRng() < 0.3) {
        assets.decals.push(`decal_${biomeConfig.id}`);
      }
    }

    if (
      biomeConfig.density.rocks &&
      tileRng() < biomeConfig.density.rocks * 0.35
    ) {
      assets.decals.push(`decal_rock_${biomeConfig.id}`);
    }

    if (
      !biomeConfig.density.props &&
      biomeConfig.density.plants &&
      tileRng() < biomeConfig.density.plants * 0.25
    ) {
      assets.decals.push(`decal_${biomeConfig.id}`);
    }

    const structureNoise = this.noiseGen.noise2D(x * 0.005, y * 0.005);
    if (structureNoise > 0.8 && tileRng() < 0.01) {
      assets.structures.push(`structure_${biomeConfig.id}`);
    }

    return assets;
  }

  async generateWorld(config: WorldGenConfig): Promise<{
    config: WorldGenConfig;
    status: WorldGenerationStatus;
  }> {
    return {
      config,
      status: WorldGenerationStatus.GENERATING,
    };
  }

  /**
   * Generates world using Voronoi diagram-based biome regions.
   * Currently returns empty array - implementation in progress.
   */
  async generateVoronoiWorld(config: WorldGenConfig): Promise<TerrainTile[][]> {
    this.initializeGenerators(config);
    this.voronoiGenerator.generateRegions(
      config.width,
      config.height,
      200,
      String(this.currentSeed),
    );
    this.voronoiGenerator.assignBiomes(
      this.voronoiGenerator.generateRegions(
        config.width,
        config.height,
        200,
        String(this.currentSeed),
      ),
      config.width,
      config.height,
    );

    return [];
  }
}
