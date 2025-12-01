import { ItemTier, ItemCategory } from "../../../shared/constants/ItemEnums";

export type { ItemTier };
export { ItemCategory };

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
