import type { WorldResourceConfig } from "../../../../domain/types/simulation/worldResources";
import {
  ResourceType,
  WorldResourceType,
  ResourceInteractionType,
} from "../../../../shared/constants/ResourceEnums";
import { BiomeType } from "../../../../shared/constants/BiomeEnums";

export const WORLD_RESOURCE_CONFIGS: Record<string, WorldResourceConfig> = {
  [WorldResourceType.TREE]: {
    type: WorldResourceType.TREE,
    displayName: "Árbol",
    interactionType: ResourceInteractionType.CHOP,
    interactionDuration: 3000,

    yields: {
      pristine: {
        resourceType: ResourceType.WOOD,
        amountMin: 8,
        amountMax: 15,
      },
      harvested_partial: {
        resourceType: ResourceType.WOOD,
        amountMin: 3,
        amountMax: 7,
      },
      depleted: {
        resourceType: ResourceType.WOOD,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 2,
    harvestsUntilDepleted: 4,

    regenerationTime: 300000, // 5 minutos - incentiva exploración
    canRegenerate: true,

    sprites: {
      pristine: "tree_full",
      harvested_partial: "tree_damaged",
      depleted: "tree_stump",
    },

    spawnProbability: 0.15,
    suitableBiomes: [
      BiomeType.FOREST,
      BiomeType.MYSTICAL,
      BiomeType.GRASSLAND,
      BiomeType.VILLAGE,
    ],
    clusterSize: { min: 3, max: 8 },
    minDistanceBetweenClusters: 200,
  },

  [WorldResourceType.ROCK]: {
    type: WorldResourceType.ROCK,
    displayName: "Roca",
    interactionType: ResourceInteractionType.MINE,
    interactionDuration: 4000,

    yields: {
      pristine: {
        resourceType: ResourceType.STONE,
        amountMin: 10,
        amountMax: 20,
        secondaryYields: [
          {
            resourceType: "iron_ore" as ResourceType,
            amountMin: 1,
            amountMax: 3,
            rareMaterialsChance: 0.15,
          },
          {
            resourceType: "copper_ore" as ResourceType,
            amountMin: 1,
            amountMax: 3,
            rareMaterialsChance: 0.15,
          },
        ],
      },
      harvested_partial: {
        resourceType: ResourceType.STONE,
        amountMin: 4,
        amountMax: 10,
        secondaryYields: [
          {
            resourceType: "iron_ore" as ResourceType,
            amountMin: 0,
            amountMax: 1,
            rareMaterialsChance: 0.1,
          },
          {
            resourceType: "copper_ore" as ResourceType,
            amountMin: 0,
            amountMax: 1,
            rareMaterialsChance: 0.1,
          },
        ],
      },
      depleted: {
        resourceType: ResourceType.STONE,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 3,
    harvestsUntilDepleted: 6,

    regenerationTime: 420000, // 7 minutos - piedra regenera muy lento
    canRegenerate: true,

    sprites: {
      pristine: "rock_intact",
      harvested_partial: "rock_cracked",
      depleted: "rock_rubble",
    },

    spawnProbability: 0.12,
    suitableBiomes: [
      BiomeType.MOUNTAINOUS,
      BiomeType.GRASSLAND,
      BiomeType.WETLAND,
      BiomeType.VILLAGE,
    ],
    clusterSize: { min: 2, max: 5 },
    minDistanceBetweenClusters: 150,
  },

  [WorldResourceType.TRASH_PILE]: {
    type: WorldResourceType.TRASH_PILE,
    displayName: "Basura",
    interactionType: ResourceInteractionType.SEARCH,
    interactionDuration: 5000,

    yields: {
      pristine: {
        resourceType: ResourceType.RARE_MATERIALS,
        amountMin: 1,
        amountMax: 3,
        rareMaterialsChance: 0.3,
      },
      depleted: {
        resourceType: ResourceType.RARE_MATERIALS,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 1,
    harvestsUntilDepleted: 1,

    regenerationTime: 600000, // 10 minutos
    canRegenerate: true,

    sprites: {
      pristine: "trash_pile",
      depleted: "trash_pile_cleared",
    },

    spawnProbability: 0.08,
    suitableBiomes: [],
    clusterSize: { min: 1, max: 3 },
    minDistanceBetweenClusters: 300,
  },

  [WorldResourceType.WATER_SOURCE]: {
    type: WorldResourceType.WATER_SOURCE,
    displayName: "Fuente de Agua",
    interactionType: ResourceInteractionType.COLLECT,
    interactionDuration: 2000,

    yields: {
      pristine: {
        resourceType: ResourceType.WATER,
        amountMin: 5,
        amountMax: 10,
      },
      depleted: {
        resourceType: ResourceType.WATER,
        amountMin: 1,
        amountMax: 2,
      },
    },

    harvestsUntilPartial: 10,
    harvestsUntilDepleted: 20,

    regenerationTime: 60000, // 1 minuto - agua regenera rápido
    canRegenerate: true,

    sprites: {
      pristine: "water_source",
      depleted: "water_source_dry",
    },

    spawnProbability: 0.4, // Increased from 0.1 - water is essential for survival
    suitableBiomes: [
      BiomeType.WETLAND,
      BiomeType.FOREST,
      BiomeType.GRASSLAND,
      BiomeType.VILLAGE,
    ],
    clusterSize: { min: 1, max: 1 },
    minDistanceBetweenClusters: 500,
  },

  [WorldResourceType.BERRY_BUSH]: {
    type: WorldResourceType.BERRY_BUSH,
    displayName: "Arbusto de Bayas",
    interactionType: ResourceInteractionType.GATHER,
    interactionDuration: 1500,

    yields: {
      pristine: {
        resourceType: ResourceType.FOOD,
        amountMin: 3,
        amountMax: 6,
      },
      depleted: {
        resourceType: ResourceType.FOOD,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 2,
    harvestsUntilDepleted: 3,

    regenerationTime: 600000, // 10 minutos - recursos escasos para fomentar caza
    canRegenerate: true,

    sprites: {
      pristine: "berry_bush_full",
      depleted: "berry_bush_empty",
    },

    spawnProbability: 0.03, // Muy reducido - fomenta caza al inicio
    suitableBiomes: [BiomeType.FOREST, BiomeType.GRASSLAND, BiomeType.VILLAGE],
    clusterSize: { min: 2, max: 4 },
    minDistanceBetweenClusters: 300,
  },

  [WorldResourceType.MUSHROOM_PATCH]: {
    type: WorldResourceType.MUSHROOM_PATCH,
    displayName: "Setas",
    interactionType: ResourceInteractionType.GATHER,
    interactionDuration: 1500,

    yields: {
      pristine: {
        resourceType: ResourceType.FOOD,
        amountMin: 2,
        amountMax: 5,
      },
      depleted: {
        resourceType: ResourceType.FOOD,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 1,
    harvestsUntilDepleted: 2,

    regenerationTime: 600000, // 10 minutos - igual que berry_bush
    canRegenerate: true,

    sprites: {
      pristine: "mushrooms",
      depleted: "mushrooms_picked",
    },

    spawnProbability: 0.05, // Reducido para fomentar caza
    suitableBiomes: [
      BiomeType.FOREST,
      BiomeType.WETLAND,
      BiomeType.MYSTICAL,
      BiomeType.VILLAGE,
    ],
    clusterSize: { min: 2, max: 4 },
    minDistanceBetweenClusters: 250,
  },

  [WorldResourceType.WHEAT_CROP]: {
    type: WorldResourceType.WHEAT_CROP,
    displayName: "Trigo Silvestre",
    interactionType: ResourceInteractionType.GATHER,
    interactionDuration: 2000,

    yields: {
      pristine: {
        resourceType: ResourceType.FOOD,
        amountMin: 5,
        amountMax: 10,
      },
      depleted: {
        resourceType: ResourceType.FOOD,
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 3,
    harvestsUntilDepleted: 5,

    regenerationTime: 600000, // 10 minutos
    canRegenerate: true,

    sprites: {
      pristine: "wheat_full",
      depleted: "wheat_harvested",
    },

    spawnProbability: 0.1,
    suitableBiomes: [BiomeType.GRASSLAND, BiomeType.VILLAGE],
    clusterSize: { min: 10, max: 20 },
    minDistanceBetweenClusters: 400,
  },
};

export function getResourceConfig(
  type: string,
): WorldResourceConfig | undefined {
  return WORLD_RESOURCE_CONFIGS[type];
}

export function getResourcesForBiome(
  biome: BiomeType | string,
): WorldResourceConfig[] {
  return Object.values(WORLD_RESOURCE_CONFIGS).filter((config) =>
    config.suitableBiomes?.includes(biome as BiomeType),
  );
}
