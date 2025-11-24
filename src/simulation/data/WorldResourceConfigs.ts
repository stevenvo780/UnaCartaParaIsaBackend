import type { WorldResourceConfig } from "../../domain/types/simulation/worldResources";

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

    regenerationTime: 120000,
    canRegenerate: false,

    sprites: {
      pristine: "tree_full",
      harvested_partial: "tree_damaged",
      depleted: "tree_stump",
    },

    spawnProbability: 0.15,
    suitableBiomes: ["forest", "mystical", "grassland"],
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

    regenerationTime: 180000,
    canRegenerate: false,

    sprites: {
      pristine: "rock_intact",
      harvested_partial: "rock_cracked",
      depleted: "rock_rubble",
    },

    spawnProbability: 0.12,
    suitableBiomes: ["mountainous", "grassland", "wetland"],
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

    harvestsUntilPartial: 0,
    harvestsUntilDepleted: 1,

    regenerationTime: 300000,
    canRegenerate: false,

    sprites: {
      pristine: "trash_pile_full",
      depleted: "trash_pile_empty",
    },

    spawnProbability: 0.05,
    suitableBiomes: ["village", "grassland"],
    clusterSize: { min: 1, max: 2 },
    minDistanceBetweenClusters: 300,
  },

  water_source: {
    type: "water_source",
    displayName: "Fuente de agua",
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
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 0,
    harvestsUntilDepleted: 10,

    regenerationTime: 60000,
    canRegenerate: false,

    sprites: {
      pristine: "water_source_full",
      depleted: "water_source_dry",
    },

    spawnProbability: 0.08,
    suitableBiomes: ["wetland", "forest", "mystical"],
    clusterSize: { min: 1, max: 2 },
    minDistanceBetweenClusters: 400,
  },

  berry_bush: {
    type: "berry_bush",
    displayName: "Arbusto de bayas",
    interactionType: "gather",
    interactionDuration: 2500,

    yields: {
      pristine: {
        resourceType: "food",
        amountMin: 3,
        amountMax: 8,
      },
      harvested_partial: {
        resourceType: "food",
        amountMin: 1,
        amountMax: 3,
      },
      depleted: {
        resourceType: "food",
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 2,
    harvestsUntilDepleted: 4,

    regenerationTime: 90000,
    canRegenerate: false,

    sprites: {
      pristine: "berry_bush_full",
      harvested_partial: "berry_bush_partial",
      depleted: "berry_bush_empty",
    },

    spawnProbability: 0.1,
    suitableBiomes: ["forest", "grassland", "mystical"],
    clusterSize: { min: 2, max: 6 },
    minDistanceBetweenClusters: 180,
  },

  mushroom_patch: {
    type: "mushroom_patch",
    displayName: "Champiñones",
    interactionType: "gather",
    interactionDuration: 2000,

    yields: {
      pristine: {
        resourceType: "food",
        amountMin: 2,
        amountMax: 6,
      },
      depleted: {
        resourceType: "food",
        amountMin: 0,
        amountMax: 0,
      },
    },

    harvestsUntilPartial: 0,
    harvestsUntilDepleted: 2,

    regenerationTime: 150000,
    canRegenerate: false,

    sprites: {
      pristine: "mushroom_patch_full",
      depleted: "mushroom_patch_empty",
    },

    spawnProbability: 0.07,
    suitableBiomes: ["forest", "mystical", "wetland"],
    clusterSize: { min: 1, max: 4 },
    minDistanceBetweenClusters: 220,
  },
};

export function getResourceConfig(
  type: string,
): WorldResourceConfig | undefined {
  return WORLD_RESOURCE_CONFIGS[type];
}

export function getResourcesForBiome(biome: string): WorldResourceConfig[] {
  return Object.values(WORLD_RESOURCE_CONFIGS).filter((config) =>
    (config.suitableBiomes ?? []).includes(biome),
  );
}
