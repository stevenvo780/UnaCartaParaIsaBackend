/**
 * Bidirectional mapping between WorldResourceType and InventoryResourceType (ResourceType).
 *
 * Resolves inconsistencies between world resource types vs inventory types
 * by providing type-safe, compile-time validated conversions.
 *
 * @module shared/types/simulation/resourceMapping
 */

import type { ResourceType } from "./economy";
import type { WorldResourceType } from "./worldResources";
import {
  ResourceType as ResourceTypeEnum,
  WorldResourceType as WorldResourceTypeEnum,
} from "../../../shared/constants/ResourceEnums";
import { MushroomVariant } from '../../constants/ResourceVariantEnums';

/**
 * Maps item IDs to base resource types.
 * This is a workaround for the architectural mismatch between:
 * - RecipesCatalog (uses specific item IDs like "fiber", "iron_ore", "wheat")
 * - Inventory system (uses only ResourceType: wood|stone|food|water|rare_materials)
 *
 * Items are collapsed into their closest resource category.
 */
export function itemToInventoryResource(itemId: string): ResourceType | null {
  if (itemId === ResourceTypeEnum.WOOD) return ResourceTypeEnum.WOOD;
  if (itemId === ResourceTypeEnum.STONE) return ResourceTypeEnum.STONE;
  if (itemId === ResourceTypeEnum.FOOD) return ResourceTypeEnum.FOOD;
  if (itemId === ResourceTypeEnum.WATER) return ResourceTypeEnum.WATER;
  if (itemId === ResourceTypeEnum.RARE_MATERIALS)
    return ResourceTypeEnum.RARE_MATERIALS;

  const woodItems = [
    "wood_log",
    "plank",
    "fiber",
    "rope",
    "leather",
    "leather_hide",
    "cloth",
  ];
  if (woodItems.includes(itemId)) return ResourceTypeEnum.WOOD;

  const stoneItems = ["coal", "clay", "brick", "obsidian", "flint"];
  if (stoneItems.includes(itemId)) return ResourceTypeEnum.STONE;

  const metalItems = ["iron_ore", "copper_ore", "iron_ingot", "copper_ingot"];
  if (metalItems.includes(itemId)) return ResourceTypeEnum.METAL;

  const foodItems = [
    "wheat",
    "flour",
    "bread",
    "berries",
    "mushrooms",
    "raw_meat",
    "cooked_meat",
    "fish",
    "cooked_fish",
    "meat_stew",
    "fruit",
    "vegetables",
    "honey",
  ];
  if (foodItems.includes(itemId)) return ResourceTypeEnum.FOOD;

  const rareItems = [
    "crystal",
    "gem",
    "diamond",
    "gold_nugget",
    "silver_nugget",
  ];
  if (rareItems.includes(itemId)) return ResourceTypeEnum.RARE_MATERIALS;

  return null;
}

/**
 * Mapping from world resources to inventory resources.
 *
 * @example
 * toInventoryResource("tree")
 * toInventoryResource("trash_pile")
 */
export const WORLD_TO_INVENTORY: Record<
  WorldResourceType,
  ResourceType | null
> = {
  [WorldResourceTypeEnum.TREE]: ResourceTypeEnum.WOOD,
  [WorldResourceTypeEnum.ROCK]: ResourceTypeEnum.STONE,
  [WorldResourceTypeEnum.WATER_SOURCE]: ResourceTypeEnum.WATER,
  [WorldResourceTypeEnum.BERRY_BUSH]: ResourceTypeEnum.FOOD,
  [WorldResourceTypeEnum.MUSHROOM_PATCH]: ResourceTypeEnum.FOOD,
  [WorldResourceTypeEnum.WHEAT_CROP]: ResourceTypeEnum.FOOD,
  [WorldResourceTypeEnum.TRASH_PILE]: null,
} as const;

/**
 * Inverse mapping: from inventory resources to possible world sources.
 * An inventory resource can come from multiple world sources.
 *
 * @example
 * INVENTORY_TO_WORLD.food
 */
export const INVENTORY_TO_WORLD: Record<ResourceType, WorldResourceType[]> = {
  [ResourceTypeEnum.WOOD]: [WorldResourceTypeEnum.TREE],
  [ResourceTypeEnum.STONE]: [WorldResourceTypeEnum.ROCK],
  [ResourceTypeEnum.WATER]: [WorldResourceTypeEnum.WATER_SOURCE],
  [ResourceTypeEnum.FOOD]: [
    WorldResourceTypeEnum.BERRY_BUSH,
    WorldResourceTypeEnum.MUSHROOM_PATCH,
    WorldResourceTypeEnum.WHEAT_CROP,
  ],
  [ResourceTypeEnum.RARE_MATERIALS]: [],
  [ResourceTypeEnum.METAL]: [WorldResourceTypeEnum.ROCK],
  [ResourceTypeEnum.IRON_ORE]: [WorldResourceTypeEnum.ROCK],
  [ResourceTypeEnum.COPPER_ORE]: [WorldResourceTypeEnum.ROCK],
};

/**
 * Type guard: validates if a string is a valid WorldResourceType.
 *
 * @param value - String to validate
 * @returns True if value is a valid WorldResourceType
 */
export function isWorldResourceType(value: string): value is WorldResourceType {
  const validTypes: WorldResourceType[] = [
    WorldResourceTypeEnum.TREE,
    WorldResourceTypeEnum.ROCK,
    WorldResourceTypeEnum.TRASH_PILE,
    WorldResourceTypeEnum.WATER_SOURCE,
    WorldResourceTypeEnum.BERRY_BUSH,
    WorldResourceTypeEnum.MUSHROOM_PATCH,
    WorldResourceTypeEnum.WHEAT_CROP,
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
    ResourceTypeEnum.WOOD,
    ResourceTypeEnum.STONE,
    ResourceTypeEnum.FOOD,
    ResourceTypeEnum.WATER,
    ResourceTypeEnum.RARE_MATERIALS,
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
 * toInventoryResource("tree")
 * toInventoryResource("trash_pile")
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
 * toWorldResources("food")
 */
export function toWorldResources(
  inventoryType: ResourceType,
): WorldResourceType[] {
  return INVENTORY_TO_WORLD[inventoryType] || [];
}

/**
 * Maps an item ID or ResourceType to possible WorldResourceTypes that yield it.
 * Handles both direct resource types (wood, stone) and specific items (iron_ore).
 */
export function itemToWorldResources(itemId: string): WorldResourceType[] {
  if (isWorldResourceType(itemId)) {
    return [itemId];
  }

  if (isResourceType(itemId)) {
    return toWorldResources(itemId);
  }

  const stoneItems = [
    "iron_ore",
    "copper_ore",
    "coal",
    "clay",
    "brick",
    "iron_ingot",
    "copper_ingot",
    "obsidian",
    "flint",
  ];
  if (stoneItems.includes(itemId)) {
    return [WorldResourceTypeEnum.ROCK];
  }

  if (["iron_ore", "copper_ore"].includes(itemId)) {
    return [WorldResourceTypeEnum.ROCK];
  }

  const woodItems = ["wood_log", "plank", "fiber", "rope"];
  if (woodItems.includes(itemId)) {
    return [WorldResourceTypeEnum.TREE];
  }

  const foodItems = ["wheat", "flour", "bread"];
  if (foodItems.includes(itemId)) {
    return [WorldResourceTypeEnum.WHEAT_CROP];
  }

  if (["berries", "fruit"].includes(itemId)) {
    return [WorldResourceTypeEnum.BERRY_BUSH];
  }

  if ([MushroomVariant.FULL].includes(itemId as MushroomVariant)) {
    return [WorldResourceTypeEnum.MUSHROOM_PATCH];
  }

  return [];
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
