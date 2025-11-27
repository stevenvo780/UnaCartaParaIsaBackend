import { ItemRarity } from "../../../shared/constants/ItemEnums";

// Re-export ItemRarity enum for backward compatibility
export { ItemRarity };

export interface GenerationRule {
  zoneType: string;
  itemId: string;
  spawnChance: number;
  minQuantity: number;
  maxQuantity: number;
  respawnTime: number;
}

export interface GeneratedItem {
  id: string;
  itemId: string;
  quantity: number;
  zoneId: string;
  generatedAt: number;
  collectedBy?: string;
  collectedAt?: number;
}

export interface ItemGenerationConfig {
  enableAutoGeneration: boolean;
  generationIntervalSec: number;
  maxItemsPerZone: number;
}

export interface ZoneItemState {
  zoneId: string;
  items: Map<string, GeneratedItem>;
  lastGeneration: number;
}
