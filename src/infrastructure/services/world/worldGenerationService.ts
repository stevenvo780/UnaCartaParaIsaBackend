import { NoiseUtils } from "../../../utils/NoiseUtils.js";
import { BiomeResolver } from "../../../domain/world/generation/BiomeResolver.js";
import {
  WorldGenConfig,
  TerrainTile,
  BiomeType,
} from "../../../domain/world/generation/types.js";
import {
  SIMPLE_BIOMES,
  SimpleBiomeConfig,
} from "../../../domain/world/generation/SimpleBiomeDefinitions.js";
import seedrandom from "seedrandom";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types.js";
import { VoronoiGenerator } from "../../../domain/world/generation/VoronoiGenerator.js";

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
   * Uses Perlin noise to generate temperature, moisture, elevation, and continentality values.
   * Resolves biomes based on these values and generates appropriate assets.
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
          globalX * 0.01,
          globalY * 0.01,
        );
        const moisture = this.noiseGen.noise2D(
          globalX * 0.01 + 1000,
          globalY * 0.01 + 1000,
        );
        const elevation = this.noiseGen.noise2D(
          globalX * 0.01 + 2000,
          globalY * 0.01 + 2000,
        );
        const continentality = this.noiseGen.noise2D(
          globalX * 0.005,
          globalY * 0.005,
        );

        const biome = this.biomeResolver.resolveBiome(
          (temperature + 1) / 2,
          (moisture + 1) / 2,
          (elevation + 1) / 2,
          (continentality + 1) / 2,
        );

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
      tileRng() < biomeConfig.density.trees * 0.1
    ) {
      const clusterNoise = this.noiseGen.noise2D(x * 0.05, y * 0.05);
      if (clusterNoise > 1 - (biomeConfig.clustering || 0.5)) {
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
      tileRng() < biomeConfig.density.props * 0.05
    ) {
      // Use decals for generic ground items instead of props
      assets.decals.push(`decal_${biomeConfig.id}`);
    }

    if (
      biomeConfig.density.rocks &&
      tileRng() < biomeConfig.density.rocks * 0.1
    ) {
      // Use decals for rocks
      assets.decals.push(`decal_rock_${biomeConfig.id}`);
    }

    const structureNoise = this.noiseGen.noise2D(x * 0.005, y * 0.005);
    if (structureNoise > 0.8 && tileRng() < 0.01) {
      assets.structures.push(`structure_${biomeConfig.id}`);
    }

    return assets;
  }

  async generateWorld(config: WorldGenConfig): Promise<{
    config: WorldGenConfig;
    status: string;
  }> {
    return {
      config,
      status: "generating",
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
