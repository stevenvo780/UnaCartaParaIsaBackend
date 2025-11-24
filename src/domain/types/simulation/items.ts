export type ItemTier = "raw" | "processed" | "craftable" | "special";

export type ItemCategory =
  | "material"
  | "food"
  | "tool"
  | "weapon"
  | "armor"
  | "structure"
  | "consumable"
  | "trade"
  | "special";

export interface ItemProperties {
  weight?: number;
  durability?: number;
  stackable?: boolean;
  maxStack?: number;
  perishable?: boolean;
  spoilTime?: number;
  value?: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  tier: ItemTier;
  category: ItemCategory;
  sprite?: string;
  properties: ItemProperties;
  metadata?: Record<string, unknown>;
}

export interface ItemSynergy {
  withItem: string;
  effect: string;
  bonus: number;
}

export interface ItemCompatibility {
  itemId: string;
  tags: string[];
  compatibleWith: string[];
  incompatibleWith: string[];
  synergies: ItemSynergy[];
}
