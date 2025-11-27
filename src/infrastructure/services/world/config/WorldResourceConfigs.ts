import type { WorldResourceConfig } from "../../../../domain/types/simulation/worldResources";

export const WORLD_RESOURCE_CONFIGS: Record<string, WorldResourceConfig> = {
  tree: {
    type: "tree",
    displayName: "Árbol",
    interactionType: "chop",
    interactionDuration: 3000,

    yields: {
      pristine: {
        resourceType: "wood",
        amountMin: 8,
        amountMax: 15,
      },
      harvested_partial: {
        resourceType: "wood",
        amountMin: 3,
        amountMax: 7,
      },
      depleted: {
        resourceType: "wood",
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
    suitableBiomes: ["forest", "mystical", "grassland", "village"],
    clusterSize: { min: 3, max: 8 },
    minDistanceBetweenClusters: 200,
  },

  rock: {
    type: "rock",
    displayName: "Roca",
    interactionType: "mine",
    interactionDuration: 4000,

    yields: {
      pristine: {
        resourceType: "stone",
        amountMin: 10,
        amountMax: 20,
      },
      harvested_partial: {
        resourceType: "stone",
        amountMin: 4,
        amountMax: 10,
      },
      depleted: {
        resourceType: "stone",
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
    suitableBiomes: ["mountainous", "grassland", "wetland", "village"],
    clusterSize: { min: 2, max: 5 },
    minDistanceBetweenClusters: 150,
  },

  trash_pile: {
    type: "trash_pile",
    displayName: "Basura",
    interactionType: "search",
    interactionDuration: 5000,

    yields: {
      pristine: {
        resourceType: "rare_materials",
        amountMin: 1,
        amountMax: 3,
        rareMaterialsChance: 0.3,
      },
      depleted: {
        resourceType: "rare_materials",
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
    suitableBiomes: ["wasteland", "urban_ruins"],
    clusterSize: { min: 1, max: 3 },
    minDistanceBetweenClusters: 300,
  },

  water_source: {
    type: "water_source",
    displayName: "Fuente de Agua",
    interactionType: "collect",
    interactionDuration: 2000,

    yields: {
      pristine: {
        resourceType: "water",
        amountMin: 5,
        amountMax: 10,
      },
      depleted: {
        resourceType: "water",
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
    suitableBiomes: ["wetland", "forest", "grassland", "village"],
    clusterSize: { min: 1, max: 1 },
    minDistanceBetweenClusters: 500,
  },

  berry_bush: {
    type: "berry_bush",
    displayName: "Arbusto de Bayas",
    interactionType: "gather",
    interactionDuration: 1500,

    yields: {
      pristine: {
        resourceType: "food",
        amountMin: 3,
        amountMax: 6,
      },
      depleted: {
        resourceType: "food",
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 2,
    harvestsUntilDepleted: 3,

    regenerationTime: 120000, // 2 minutos
    canRegenerate: true,

    sprites: {
      pristine: "berry_bush_full",
      depleted: "berry_bush_empty",
    },

    spawnProbability: 0.4, // Increased from 0.2 - food is essential for survival
    suitableBiomes: ["forest", "grassland", "village"],
    clusterSize: { min: 4, max: 10 },
    minDistanceBetweenClusters: 100,
  },

  mushroom_patch: {
    type: "mushroom_patch",
    displayName: "Setas",
    interactionType: "gather",
    interactionDuration: 1500,

    yields: {
      pristine: {
        resourceType: "food",
        amountMin: 2,
        amountMax: 5,
      },
      depleted: {
        resourceType: "food",
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 1,
    harvestsUntilDepleted: 2,

    regenerationTime: 180000, // 3 minutos
    canRegenerate: true,

    sprites: {
      pristine: "mushrooms",
      depleted: "mushrooms_picked",
    },

    spawnProbability: 0.15,
    suitableBiomes: ["forest", "wetland", "mystical", "village"],
    clusterSize: { min: 3, max: 6 },
    minDistanceBetweenClusters: 150,
  },

  wheat_crop: {
    type: "wheat_crop",
    displayName: "Trigo Silvestre",
    interactionType: "gather",
    interactionDuration: 2000,

    yields: {
      pristine: {
        resourceType: "food",
        amountMin: 5,
        amountMax: 10,
      },
      depleted: {
        resourceType: "food",
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
    suitableBiomes: ["grassland", "village"],
    clusterSize: { min: 10, max: 20 },
    minDistanceBetweenClusters: 400,
  },
};

export function getResourceConfig(
  type: string,
): WorldResourceConfig | undefined {
  return WORLD_RESOURCE_CONFIGS[type];
}

export function getResourcesForBiome(biome: string): WorldResourceConfig[] {
  return Object.values(WORLD_RESOURCE_CONFIGS).filter((config) =>
    config.suitableBiomes?.includes(biome),
  );
}
