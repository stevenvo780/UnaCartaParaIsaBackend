import { NoiseUtils } from '../../../utils/NoiseUtils.js';
import { VoronoiGenerator } from '../../../domain/world/generation/VoronoiGenerator.js';
import { BiomeResolver } from '../../../domain/world/generation/BiomeResolver.js';
import { WorldGenConfig, TerrainTile, BiomeType } from '../../../domain/world/generation/types.js';
import { SIMPLE_BIOMES, SimpleBiomeConfig } from '../../../domain/world/generation/SimpleBiomeDefinitions.js';
import seedrandom from 'seedrandom';

export class WorldGenerationService {
  private noiseGen: NoiseUtils;
  private biomeResolver: BiomeResolver;
  private biomeMap: Map<BiomeType, SimpleBiomeConfig>;

  constructor() {
    this.noiseGen = new NoiseUtils();
    this.biomeResolver = new BiomeResolver();
    this.biomeMap = new Map(SIMPLE_BIOMES.map(b => [b.id, b]));
  }

  private initializeGenerators(config: WorldGenConfig): void {
    this.noiseGen = new NoiseUtils(config.seed);
    // rng and voronoiGen would be initialized here for future use
    // Currently only noiseGen is used for biome generation
    // Config is used via config.seed above, but voronoiGen and rng are not yet implemented
    void config.width; // Keep for potential future use
    void config.height; // Keep for potential future use
  }

  async generateChunk(x: number, y: number, config: WorldGenConfig): Promise<TerrainTile[][]> {
    this.initializeGenerators(config);
    
    const tiles: TerrainTile[][] = [];
    const chunkSize = 16; 

    for (let i = 0; i < chunkSize; i++) {
      const row: TerrainTile[] = [];
      for (let j = 0; j < chunkSize; j++) {
        const globalX = x * chunkSize + j;
        const globalY = y * chunkSize + i;
        
        // Generate base noise values
        const temperature = this.noiseGen.noise2D(globalX * 0.01, globalY * 0.01);
        const moisture = this.noiseGen.noise2D(globalX * 0.01 + 1000, globalY * 0.01 + 1000);
        const elevation = this.noiseGen.noise2D(globalX * 0.01 + 2000, globalY * 0.01 + 2000);
        const continentality = this.noiseGen.noise2D(globalX * 0.005, globalY * 0.005);

        // Resolve biome
        const biome = this.biomeResolver.resolveBiome(
          (temperature + 1) / 2, 
          (moisture + 1) / 2,
          (elevation + 1) / 2,
          (continentality + 1) / 2
        );

        const biomeConfig = this.biomeMap.get(biome);
        const assets = this.generateAssetsForTile(biomeConfig, globalX, globalY);

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
            ...assets
          }
        });
      }
      tiles.push(row);
    }

    return tiles;
  }

  private generateAssetsForTile(biomeConfig: SimpleBiomeConfig | undefined, x: number, y: number) {
    const assets = {
      vegetation: [] as string[],
      props: [] as string[],
      structures: [] as string[],
      decals: [] as string[]
    };

    if (!biomeConfig) return assets;

    // Deterministic RNG for this tile
    const tileRng = seedrandom(`${x},${y}-${this.noiseGen['seed']}`);

    // Trees
    if (biomeConfig.density.trees && tileRng() < biomeConfig.density.trees * 0.1) {
       // 10% chance base * density. This is a simplification.
       // In a real implementation, we would use noise for clustering.
       const clusterNoise = this.noiseGen.noise2D(x * 0.05, y * 0.05);
       if (clusterNoise > (1 - (biomeConfig.clustering || 0.5))) {
         assets.vegetation.push(`tree_${biomeConfig.id}`);
       }
    }

    // Plants
    if (biomeConfig.density.plants && tileRng() < biomeConfig.density.plants * 0.2) {
        assets.vegetation.push(`plant_${biomeConfig.id}`);
    }

    // Props
    if (biomeConfig.density.props && tileRng() < biomeConfig.density.props * 0.05) {
        assets.props.push(`prop_${biomeConfig.id}`);
    }

    // Structures
    // Use a different noise scale for structures to create sparse clusters
    const structureNoise = this.noiseGen.noise2D(x * 0.005, y * 0.005); // Low frequency
    if (structureNoise > 0.8 && tileRng() < 0.01) { // High threshold + very low random chance
        assets.structures.push(`structure_${biomeConfig.id}`);
    }

    return assets;
  }

  async generateWorld(config: WorldGenConfig) {
    return {
      config,
      status: 'generating'
    };
  }
}

export const worldGenerationService = new WorldGenerationService();
