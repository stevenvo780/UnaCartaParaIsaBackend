import type {
  ItemCompatibility,
  ItemSynergy,
} from "../../domain/types/simulation/items";

export class ItemCompatibilityCatalog {
  private static readonly compatibilities: Record<string, ItemCompatibility> = {
    wood_log: {
      itemId: "wood_log",
      tags: ["wood", "raw", "burnable", "natural"],
      compatibleWith: ["stone", "iron_ingot", "fiber", "rope"],
      incompatibleWith: [],
      synergies: [
        { withItem: "stone", effect: "durability", bonus: 1.2 },
        { withItem: "fiber", effect: "flexibility", bonus: 1.1 },
      ],
    },

    stone: {
      itemId: "stone",
      tags: ["mineral", "raw", "hard", "heavy"],
      compatibleWith: ["wood_log", "fiber", "clay"],
      incompatibleWith: ["water"],
      synergies: [
        { withItem: "wood_log", effect: "tool_efficiency", bonus: 1.3 },
        { withItem: "clay", effect: "structural", bonus: 1.4 },
      ],
    },

    iron_ore: {
      itemId: "iron_ore",
      tags: ["mineral", "raw", "metal", "heavy"],
      compatibleWith: ["coal", "copper_ore"],
      incompatibleWith: ["water"],
      synergies: [{ withItem: "coal", effect: "smelting", bonus: 2.0 }],
    },

    copper_ore: {
      itemId: "copper_ore",
      tags: ["mineral", "raw", "metal", "heavy"],
      compatibleWith: ["coal", "iron_ore"],
      incompatibleWith: ["water"],
      synergies: [{ withItem: "coal", effect: "smelting", bonus: 1.8 }],
    },

    coal: {
      itemId: "coal",
      tags: ["mineral", "raw", "burnable", "fuel"],
      compatibleWith: ["iron_ore", "copper_ore", "clay"],
      incompatibleWith: [],
      synergies: [
        { withItem: "iron_ore", effect: "heat", bonus: 2.0 },
        { withItem: "copper_ore", effect: "heat", bonus: 1.8 },
      ],
    },

    fiber: {
      itemId: "fiber",
      tags: ["plant", "raw", "flexible", "light"],
      compatibleWith: [
        "wood_log",
        "stone",
        "leather",
        "cloth",
        "plank",
        "iron_ingot",
      ],
      incompatibleWith: [],
      synergies: [
        { withItem: "wood_log", effect: "binding", bonus: 1.5 },
        { withItem: "leather", effect: "durability", bonus: 1.3 },
      ],
    },

    clay: {
      itemId: "clay",
      tags: ["mineral", "raw", "malleable", "structural"],
      compatibleWith: ["stone", "coal", "water"],
      incompatibleWith: [],
      synergies: [
        { withItem: "stone", effect: "construction", bonus: 1.6 },
        { withItem: "coal", effect: "hardening", bonus: 2.0 },
      ],
    },

    leather_hide: {
      itemId: "leather_hide",
      tags: ["animal", "raw", "flexible", "protective"],
      compatibleWith: ["water", "fiber"],
      incompatibleWith: [],
      synergies: [{ withItem: "water", effect: "tanning", bonus: 1.5 }],
    },

    wheat: {
      itemId: "wheat",
      tags: ["plant", "raw", "food", "grindable"],
      compatibleWith: [],
      incompatibleWith: ["water"],
      synergies: [],
    },

    berries: {
      itemId: "berries",
      tags: ["plant", "raw", "food", "perishable"],
      compatibleWith: ["water", "cooked_meat"],
      incompatibleWith: [],
      synergies: [{ withItem: "cooked_meat", effect: "nutrition", bonus: 1.3 }],
    },

    raw_meat: {
      itemId: "raw_meat",
      tags: ["animal", "raw", "food", "perishable", "cookable"],
      compatibleWith: ["berries", "water"],
      incompatibleWith: [],
      synergies: [],
    },

    fish: {
      itemId: "fish",
      tags: ["animal", "raw", "food", "perishable", "cookable"],
      compatibleWith: ["water"],
      incompatibleWith: [],
      synergies: [],
    },

    water: {
      itemId: "water",
      tags: ["liquid", "raw", "essential", "cooking"],
      compatibleWith: [
        "wheat",
        "clay",
        "leather_hide",
        "berries",
        "raw_meat",
        "flour",
      ],
      incompatibleWith: ["stone", "iron_ore", "copper_ore"],
      synergies: [
        { withItem: "flour", effect: "cooking", bonus: 1.5 },
        { withItem: "clay", effect: "molding", bonus: 1.3 },
      ],
    },

    plank: {
      itemId: "plank",
      tags: ["wood", "processed", "structural", "burnable"],
      compatibleWith: ["rope", "iron_ingot", "fiber", "brick"],
      incompatibleWith: [],
      synergies: [
        { withItem: "iron_ingot", effect: "reinforcement", bonus: 1.5 },
        { withItem: "rope", effect: "construction", bonus: 1.4 },
      ],
    },

    iron_ingot: {
      itemId: "iron_ingot",
      tags: ["metal", "processed", "hard", "heavy", "forgeable"],
      compatibleWith: ["plank", "leather", "fiber"],
      incompatibleWith: [],
      synergies: [
        { withItem: "plank", effect: "tool_quality", bonus: 1.8 },
        { withItem: "leather", effect: "weapon_grip", bonus: 1.4 },
      ],
    },

    copper_ingot: {
      itemId: "copper_ingot",
      tags: ["metal", "processed", "soft", "conductive", "forgeable"],
      compatibleWith: ["plank", "iron_ingot"],
      incompatibleWith: [],
      synergies: [{ withItem: "iron_ingot", effect: "alloy", bonus: 1.6 }],
    },

    leather: {
      itemId: "leather",
      tags: ["animal", "processed", "flexible", "protective"],
      compatibleWith: ["fiber", "iron_ingot", "plank"],
      incompatibleWith: [],
      synergies: [
        { withItem: "fiber", effect: "sewing", bonus: 1.3 },
        { withItem: "iron_ingot", effect: "armor", bonus: 1.5 },
      ],
    },

    cloth: {
      itemId: "cloth",
      tags: ["textile", "processed", "light", "flexible"],
      compatibleWith: ["fiber", "leather"],
      incompatibleWith: [],
      synergies: [{ withItem: "fiber", effect: "sewing", bonus: 1.4 }],
    },

    rope: {
      itemId: "rope",
      tags: ["textile", "processed", "flexible", "binding"],
      compatibleWith: ["plank", "wood_log", "stone"],
      incompatibleWith: [],
      synergies: [
        { withItem: "plank", effect: "construction", bonus: 1.5 },
        { withItem: "wood_log", effect: "tool_assembly", bonus: 1.3 },
      ],
    },

    flour: {
      itemId: "flour",
      tags: ["food", "processed", "cookable"],
      compatibleWith: ["water"],
      incompatibleWith: [],
      synergies: [{ withItem: "water", effect: "baking", bonus: 1.8 }],
    },

    cooked_meat: {
      itemId: "cooked_meat",
      tags: ["food", "processed", "nutritious"],
      compatibleWith: ["berries", "water"],
      incompatibleWith: [],
      synergies: [{ withItem: "berries", effect: "flavor", bonus: 1.2 }],
    },

    cooked_fish: {
      itemId: "cooked_fish",
      tags: ["food", "processed", "nutritious"],
      compatibleWith: ["water"],
      incompatibleWith: [],
      synergies: [],
    },

    brick: {
      itemId: "brick",
      tags: ["mineral", "processed", "hard", "structural"],
      compatibleWith: ["plank", "stone"],
      incompatibleWith: [],
      synergies: [{ withItem: "stone", effect: "construction", bonus: 1.7 }],
    },

    stone_axe: {
      itemId: "stone_axe",
      tags: ["tool", "craftable", "cutting", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    stone_pickaxe: {
      itemId: "stone_pickaxe",
      tags: ["tool", "craftable", "mining", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    iron_axe: {
      itemId: "iron_axe",
      tags: ["tool", "craftable", "cutting", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    iron_pickaxe: {
      itemId: "iron_pickaxe",
      tags: ["tool", "craftable", "mining", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    wooden_club: {
      itemId: "wooden_club",
      tags: ["weapon", "craftable", "blunt", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    stone_dagger: {
      itemId: "stone_dagger",
      tags: ["weapon", "craftable", "piercing", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    iron_sword: {
      itemId: "iron_sword",
      tags: ["weapon", "craftable", "slashing", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    bow: {
      itemId: "bow",
      tags: ["weapon", "craftable", "ranged", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    cloth_shirt: {
      itemId: "cloth_shirt",
      tags: ["armor", "craftable", "light", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    leather_vest: {
      itemId: "leather_vest",
      tags: ["armor", "craftable", "medium", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    iron_helmet: {
      itemId: "iron_helmet",
      tags: ["armor", "craftable", "heavy", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    bread: {
      itemId: "bread",
      tags: ["food", "craftable", "nutritious", "preserved"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    meat_stew: {
      itemId: "meat_stew",
      tags: ["food", "craftable", "nutritious", "complex"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    wooden_frame: {
      itemId: "wooden_frame",
      tags: ["structure", "craftable", "construction", "basic"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    stone_foundation: {
      itemId: "stone_foundation",
      tags: ["structure", "craftable", "construction", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },

    door: {
      itemId: "door",
      tags: ["structure", "craftable", "functional", "advanced"],
      compatibleWith: [],
      incompatibleWith: [],
      synergies: [],
    },
  };

  static getCompatibility(itemId: string): ItemCompatibility | null {
    return this.compatibilities[itemId] || null;
  }

  static areCompatible(itemA: string, itemB: string): boolean {
    const compatA = this.compatibilities[itemA];
    if (!compatA) return false;

    if (compatA.incompatibleWith.includes(itemB)) return false;
    if (compatA.compatibleWith.includes(itemB)) return true;

    const compatB = this.compatibilities[itemB];
    if (!compatB) return false;

    const commonTags = compatA.tags.filter((tag) => compatB.tags.includes(tag));
    return commonTags.length > 0;
  }

  static getSynergy(itemA: string, itemB: string): ItemSynergy | null {
    const compatA = this.compatibilities[itemA];
    if (!compatA) return null;

    return compatA.synergies.find((s) => s.withItem === itemB) || null;
  }

  static calculateDiscoveryChance(ingredients: string[]): number {
    if (ingredients.length < 2) return 0;

    let totalCompatibility = 0;
    let pairs = 0;

    for (let i = 0; i < ingredients.length; i++) {
      for (let j = i + 1; j < ingredients.length; j++) {
        pairs++;
        if (this.areCompatible(ingredients[i], ingredients[j])) {
          totalCompatibility++;

          const synergy = this.getSynergy(ingredients[i], ingredients[j]);
          if (synergy) {
            totalCompatibility += 0.5;
          }
        }
      }
    }

    return pairs > 0 ? totalCompatibility / pairs : 0;
  }

  static getCompatibleItems(itemId: string): string[] {
    const compat = this.compatibilities[itemId];
    return compat ? compat.compatibleWith : [];
  }

  static getItemsByTag(tag: string): string[] {
    return Object.values(this.compatibilities)
      .filter((c) => c.tags.includes(tag))
      .map((c) => c.itemId);
  }

  static suggestCombinations(availableItems: string[]): string[][] {
    const suggestions: string[][] = [];

    for (let i = 0; i < availableItems.length; i++) {
      for (let j = i + 1; j < availableItems.length; j++) {
        if (this.areCompatible(availableItems[i], availableItems[j])) {
          suggestions.push([availableItems[i], availableItems[j]]);
        }
      }
    }

    return suggestions.sort((a, b) => {
      const synergyA = this.getSynergy(a[0], a[1])?.bonus || 0;
      const synergyB = this.getSynergy(b[0], b[1])?.bonus || 0;
      return synergyB - synergyA;
    });
  }
}
