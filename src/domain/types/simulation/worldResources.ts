import {
  WorldResourceType,
  ResourceState,
  ResourceInteractionType,
  ResourceType,
} from "../../../shared/constants/ResourceEnums";
import { BiomeType } from "../../../shared/constants/BiomeEnums";

/**
 * Re-export enums for backward compatibility.
 */
export { WorldResourceType, ResourceState, ResourceInteractionType };

export interface Position {
  x: number;
  y: number;
}

export interface ResourceYield {
  resourceType: ResourceType;
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
  suitableBiomes?: BiomeType[];
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
  biome?: BiomeType;
  spawnedAt?: number;
}

export interface HarvestResult {
  success: boolean;
  yields?: { [key: string]: number };
  newState?: ResourceState;
  depleted?: boolean;
}
