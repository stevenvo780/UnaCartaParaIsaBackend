export interface Position {
  x: number;
  y: number;
}

export type WorldResourceType =
  | "tree"
  | "rock"
  | "trash_pile"
  | "water_source"
  | "berry_bush"
  | "mushroom_patch"
  | "wheat_crop";

export type ResourceState =
  | "pristine"
  | "harvested_partial"
  | "depleted"
  | "regenerating";

export type ResourceInteractionType =
  | "chop"
  | "mine"
  | "search"
  | "collect"
  | "gather";

export interface ResourceYield {
  resourceType: "wood" | "stone" | "food" | "water" | "rare_materials";
  amountMin: number;
  amountMax: number;
  rareMaterialsChance?: number;
}

export interface WorldResourceConfig {
  type: WorldResourceType;
  displayName: string;
  interactionType: ResourceInteractionType;
  interactionDuration: number;

  yields: {
    pristine: ResourceYield;
    harvested_partial?: ResourceYield;
    depleted: ResourceYield;
  };

  harvestsUntilPartial: number;
  harvestsUntilDepleted: number;

  regenerationTime: number;
  canRegenerate: boolean;

  sprites?: {
    pristine: string;
    harvested_partial?: string;
    depleted: string;
  };

  spawnProbability?: number;
  suitableBiomes?: string[];
  clusterSize?: { min: number; max: number };
  minDistanceBetweenClusters?: number;
}

export interface WorldResourceInstance {
  id: string;
  type: WorldResourceType;
  position: Position;
  state: ResourceState;
  harvestCount: number;
  lastHarvestTime?: number;
  regenerationStartTime?: number;
  biome?: string;
}

export interface HarvestResult {
  success: boolean;
  yields?: { [key: string]: number };
  newState?: ResourceState;
  depleted?: boolean;
}
