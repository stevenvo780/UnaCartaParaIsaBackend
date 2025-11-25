/**
 * Mapeo bidireccional entre WorldResourceType e InventoryResourceType (ResourceType)
 *
 * Resuelve la inconsistencia entre tipos de recursos del mundo vs inventario
 * proporcionando conversiones type-safe y validadas en compile-time.
 *
 * @module domain/types/simulation/resourceMapping
 */

import type { ResourceType } from "./economy";
import type { WorldResourceType } from "./worldResources";

/**
 * Mapeo de recursos del mundo a recursos de inventario.
 *
 * @example
 * toInventoryResource("tree") // "wood"
 * toInventoryResource("trash_pile") // null (no genera recurso de inventario)
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
  trash_pile: null, // no produce recursos de inventario directamente
} as const;

/**
 * Mapeo inverso: de recursos de inventario a posibles fuentes en el mundo.
 * Un recurso de inventario puede provenir de múltiples fuentes.
 *
 * @example
 * INVENTORY_TO_WORLD.food // ["berry_bush", "mushroom_patch", "wheat_crop"]
 */
export const INVENTORY_TO_WORLD: Record<ResourceType, WorldResourceType[]> = {
  wood: ["tree"] as WorldResourceType[],
  stone: ["rock"] as WorldResourceType[],
  water: ["water_source"] as WorldResourceType[],
  food: ["berry_bush", "mushroom_patch", "wheat_crop"] as WorldResourceType[],
  rare_materials: [] as WorldResourceType[], // se obtiene como drop raro, no de recursos específicos
};

/**
 * Type guard: valida si un string es un WorldResourceType válido
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
 * Type guard: valida si un string es un ResourceType válido
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
 * Convierte un WorldResourceType a su ResourceType equivalente de inventario.
 * Retorna null si el recurso no genera items de inventario.
 *
 * @param worldType - Tipo de recurso del mundo
 * @returns ResourceType correspondiente o null
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
 * Convierte un ResourceType de inventario a sus posibles fuentes en el mundo.
 *
 * @param inventoryType - Tipo de recurso de inventario
 * @returns Array de WorldResourceType que producen este recurso
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
 * Valida que los mapeos sean consistentes (cada WorldResourceType mapeado existe en el inverso)
 * Esta función se ejecuta en desarrollo para detectar inconsistencias.
 */
export function validateMappings(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar que todo WorldResourceType con valor no-null tenga entrada en INVENTORY_TO_WORLD
  for (const [worldType, inventoryType] of Object.entries(WORLD_TO_INVENTORY)) {
    if (inventoryType !== null) {
      const reverseMapping = INVENTORY_TO_WORLD[inventoryType];
      if (!reverseMapping) {
        errors.push(
          `WORLD_TO_INVENTORY[${worldType}] -> ${inventoryType}, pero INVENTORY_TO_WORLD[${inventoryType}] no existe`,
        );
      } else if (!reverseMapping.includes(worldType as WorldResourceType)) {
        errors.push(
          `WORLD_TO_INVENTORY[${worldType}] -> ${inventoryType}, pero ${worldType} no está en INVENTORY_TO_WORLD[${inventoryType}]`,
        );
      }
    }
  }

  // Validar el inverso
  for (const [inventoryType, worldTypes] of Object.entries(
    INVENTORY_TO_WORLD,
  )) {
    for (const worldType of worldTypes) {
      const forwardMapping = WORLD_TO_INVENTORY[worldType];
      if (forwardMapping !== inventoryType) {
        errors.push(
          `INVENTORY_TO_WORLD[${inventoryType}] incluye ${worldType}, pero WORLD_TO_INVENTORY[${worldType}] -> ${forwardMapping}`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
