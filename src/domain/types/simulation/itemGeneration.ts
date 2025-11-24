export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

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
