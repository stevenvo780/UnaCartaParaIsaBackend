export const enum BiomeType {
  GRASSLAND = "grassland",
  FOREST = "forest",
  DESERT = "desert",
  TUNDRA = "tundra",
  SWAMP = "swamp",
  MOUNTAIN = "mountain",
  BEACH = "beach",
  OCEAN = "ocean",
  RIVER = "river",
  LAKE = "lake",
  MYSTICAL = "mystical",
  WETLAND = "wetland",
  MOUNTAINOUS = "mountainous",
  VILLAGE = "village",
}

export interface BiomeDefinition {
  id: BiomeType;
  name: string;
  description: string;
  color: string;
  isWalkable: boolean;
  conditions: {
    temperatureRange: [number, number];
    moistureRange: [number, number];
    elevationRange: [number, number];
    distanceFromWater?: number;
  };
  assets: {
    terrain: {
      primary: string[];
      secondary: string[];
      weight: number[];
    };
    tileIds?: {
      terrain: number[];
      water?: number[];
      autotiles?: number[];
      decorations?: number[];
    };

    trees: {
      primary: string[];
      rare: string[];
      density: number;
      clustering: number;
    };
    shrubs: {
      assets: string[];
      density: number;
    };
    props: {
      common: string[];
      rare: string[];
      density: number;
    };
    structures?: {
      assets: string[];
      density: number;
      spacing: number;
    };
    decals: {
      assets: string[];
      density: number;
    };
  };
  generation: {
    tileSize: number;
    transitionWidth: number;
    minClusterSize: number;
    spawnProbabilities: Record<string, number>;
  };
}

export interface TerrainTile {
  x: number;
  y: number;
  biome: BiomeType;
  biomeStrength: number;
  temperature: number;
  moisture: number;
  elevation: number;
  isWalkable: boolean;
  assets: {
    terrain: string;
    vegetation: string[];
    props: string[];
    structures: string[];
    decals: string[];
  };
}

export interface WorldGenConfig {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  tileSize: number;
  seed: number | string;
  noise: {
    temperature: {
      scale: number;
      octaves: number;
      persistence: number;
      lacunarity: number;
    };
    moisture: {
      scale: number;
      octaves: number;
      persistence: number;
      lacunarity: number;
    };
    elevation: {
      scale: number;
      octaves: number;
      persistence: number;
      lacunarity: number;
    };
  };
}

export interface WorldLayer {
  name: string;
  tiles: TerrainTile[][];
  width: number;
  height: number;
}

export interface GeneratedWorld {
  config: WorldGenConfig;
  terrain: TerrainTile[][];
  layers: WorldLayer[];
  stats: {
    biomeCounts: Record<BiomeType, number>;
    generationTime: number;
  };
}
