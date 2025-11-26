/**
 * Bidirectional mapping between WorldResourceType and InventoryResourceType (ResourceType).
 *
 * Resolves inconsistencies between world resource types vs inventory types
 * by providing type-safe, compile-time validated conversions.
 *
 * @module domain/types/simulation/resourceMapping
 */

import type { ResourceType } from "./economy";
import type { WorldResourceType } from "./worldResources";

/**
 * Mapping from world resources to inventory resources.
 *
 * @example
 * toInventoryResource("tree") // "wood"
 * toInventoryResource("trash_pile") // null (does not generate inventory resource)
 */
export const WORLD_TO_INVENTORY: Record<
  WorldResourceType,
  ResourceType | null
> = {
  tree: "wood",
  rock: "stone",
  water_source: "water",
  berry_bush: "food",
  mushroom_patch: "food",
  wheat_crop: "food",
  trash_pile: null,
} as const;

/**
 * Inverse mapping: from inventory resources to possible world sources.
 * An inventory resource can come from multiple world sources.
 *
 * @example
 * INVENTORY_TO_WORLD.food // ["berry_bush", "mushroom_patch", "wheat_crop"]
 */
export const INVENTORY_TO_WORLD: Record<ResourceType, WorldResourceType[]> = {
  wood: ["tree"] as WorldResourceType[],
  stone: ["rock"] as WorldResourceType[],
  water: ["water_source"] as WorldResourceType[],
  food: ["berry_bush", "mushroom_patch", "wheat_crop"] as WorldResourceType[],
  rare_materials: [] as WorldResourceType[],
};

/**
 * Type guard: validates if a string is a valid WorldResourceType.
 *
 * @param value - String to validate
 * @returns True if value is a valid WorldResourceType
 */
export function isWorldResourceType(value: string): value is WorldResourceType {
  const validTypes: WorldResourceType[] = [
    "tree",
    "rock",
    "trash_pile",
    "water_source",
    "berry_bush",
    "mushroom_patch",
    "wheat_crop",
  ];
  return validTypes.includes(value as WorldResourceType);
}

/**
 * Type guard: validates if a string is a valid ResourceType.
 *
 * @param value - String to validate
 * @returns True if value is a valid ResourceType
 */
export function isResourceType(value: string): value is ResourceType {
  const validTypes: ResourceType[] = [
    "wood",
    "stone",
    "food",
    "water",
    "rare_materials",
  ];
  return validTypes.includes(value as ResourceType);
}

/**
 * Converts a WorldResourceType to its equivalent inventory ResourceType.
 * Returns null if the resource does not generate inventory items.
 *
 * @param worldType - World resource type
 * @returns Corresponding ResourceType or null
 *
 * @example
 * toInventoryResource("tree") // "wood"
 * toInventoryResource("trash_pile") // null
 */
export function toInventoryResource(
  worldType: WorldResourceType,
): ResourceType | null {
  return WORLD_TO_INVENTORY[worldType];
}

/**
 * Converts an inventory ResourceType to its possible world sources.
 *
 * @param inventoryType - Inventory resource type
 * @returns Array of WorldResourceType that produce this resource
 *
 * @example
 * toWorldResources("food") // ["berry_bush", "mushroom_patch", "wheat_crop"]
 */
export function toWorldResources(
  inventoryType: ResourceType,
): WorldResourceType[] {
  return INVENTORY_TO_WORLD[inventoryType] || [];
}

/**
 * Validates that mappings are consistent (each mapped WorldResourceType exists in the inverse).
 * This function runs in development to detect inconsistencies.
 *
 * @returns Validation result with errors if any
 */
export function validateMappings(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [worldType, inventoryType] of Object.entries(WORLD_TO_INVENTORY)) {
    if (inventoryType !== null) {
      const reverseMapping = INVENTORY_TO_WORLD[inventoryType];
      if (!reverseMapping) {
        errors.push(
          `WORLD_TO_INVENTORY[${worldType}] -> ${inventoryType}, but INVENTORY_TO_WORLD[${inventoryType}] does not exist`,
        );
      } else if (!reverseMapping.includes(worldType as WorldResourceType)) {
        errors.push(
          `WORLD_TO_INVENTORY[${worldType}] -> ${inventoryType}, but ${worldType} is not in INVENTORY_TO_WORLD[${inventoryType}]`,
        );
      }
    }
  }

  for (const [inventoryType, worldTypes] of Object.entries(
    INVENTORY_TO_WORLD,
  )) {
    for (const worldType of worldTypes) {
      const forwardMapping = WORLD_TO_INVENTORY[worldType];
      if (forwardMapping !== inventoryType) {
        errors.push(
          `INVENTORY_TO_WORLD[${inventoryType}] includes ${worldType}, but WORLD_TO_INVENTORY[${worldType}] -> ${forwardMapping}`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
