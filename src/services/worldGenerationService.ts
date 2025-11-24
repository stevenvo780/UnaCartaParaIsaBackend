import { NoiseUtils } from '../utils/NoiseUtils.js';

export interface WorldGenConfig {
  seed: string | number;
  width: number;
  height: number;
  tileSize: number;
}

export class WorldGenerationService {
  private noiseUtils: NoiseUtils;

  constructor() {
    this.noiseUtils = new NoiseUtils();
  }

  async generateChunk(x: number, y: number, config: WorldGenConfig) {
    // Placeholder for chunk generation logic
    // This will eventually contain the logic currently in TerrainGenerator.ts
    return {
      x,
      y,
      data: 'Chunk data placeholder',
      biome: 'plains' // Placeholder
    };
  }

  async generateWorld(config: WorldGenConfig) {
    // Placeholder for full world generation
    return {
      config,
      status: 'generating'
    };
  }
}

export const worldGenerationService = new WorldGenerationService();
