import type { CraftingRecipe } from "../../domain/types/simulation/crafting";
import { ItemId } from "../../shared/constants/ItemEnums";
import {
  WorkstationType,
  SkillType,
} from "../../shared/constants/CraftingEnums";

export class BiomeRecipesCatalog {
  private static readonly biomeRecipes: Record<string, CraftingRecipe[]> = {
    mystical: [
      {
        id: "mystical_potion",
        name: "Poción Mística",
        description: "Una poción brillante con propiedades místicas",
        output: { itemId: ItemId.MYSTICAL_POTION, quantity: 1 },
        ingredients: [
          { itemId: ItemId.MUSHROOM_MYSTICAL, quantity: 3 },
          { itemId: ItemId.GLOWING_CRYSTAL, quantity: 1 },
          { itemId: ItemId.WATER, quantity: 2 },
        ],
        requirements: {
          workstation: WorkstationType.ALCHEMY_TABLE,
        },
        craftingTime: 15000,
        difficulty: 6,
        successRate: 0.7,
      },
      {
        id: "crystal_tool",
        name: "Herramienta de Cristal",
        description: "Una herramienta mística que nunca se desgasta",
        output: { itemId: ItemId.CRYSTAL_PICKAXE, quantity: 1 },
        ingredients: [
          { itemId: ItemId.GLOWING_CRYSTAL, quantity: 5 },
          { itemId: ItemId.MYSTICAL_FIBER, quantity: 3 },
          { itemId: ItemId.PLANK, quantity: 2 },
        ],
        requirements: {
          skill: "mysticism",
          skillLevel: 3,
        },
        craftingTime: 20000,
        difficulty: 7,
        successRate: 0.65,
      },
      {
        id: "energy_crystal",
        name: "Cristal Energético",
        description: "Cristal procesado que almacena energía mística",
        output: { itemId: ItemId.ENERGY_CRYSTAL, quantity: 1 },
        ingredients: [
          { itemId: ItemId.GLOWING_CRYSTAL, quantity: 3 },
          { itemId: ItemId.MUSHROOM_MYSTICAL, quantity: 2 },
        ],
        craftingTime: 10000,
        difficulty: 5,
        successRate: 0.8,
      },
    ],

    wetland: [
      {
        id: "swamp_antidote",
        name: "Antídoto Pantanoso",
        description: "Cura envenenamiento y enfermedades",
        output: { itemId: ItemId.SWAMP_ANTIDOTE, quantity: 2 },
        ingredients: [
          { itemId: ItemId.SWAMP_HERB, quantity: 3 },
          { itemId: ItemId.CLAY, quantity: 1 },
          { itemId: ItemId.WATER, quantity: 2 },
        ],
        requirements: {
          skill: SkillType.HERBALISM,
          skillLevel: 2,
        },
        craftingTime: 8000,
        difficulty: 4,
        successRate: 0.85,
      },
      {
        id: "reed_basket",
        name: "Cesta de Juncos",
        description: "Cesta ligera que aumenta capacidad de inventario",
        output: { itemId: ItemId.REED_BASKET, quantity: 1 },
        ingredients: [
          { itemId: ItemId.REEDS, quantity: 10 },
          { itemId: ItemId.FIBER, quantity: 5 },
        ],
        craftingTime: 12000,
        difficulty: 3,
        successRate: 0.9,
      },
      {
        id: "clay_pottery",
        name: "Cerámica de Arcilla",
        description: "Vasija para almacenar agua y alimentos",
        output: { itemId: ItemId.CLAY_POT, quantity: 1 },
        ingredients: [
          { itemId: ItemId.CLAY, quantity: 5 },
          { itemId: ItemId.WATER, quantity: 2 },
        ],
        requirements: {
          workstation: WorkstationType.KILN,
        },
        craftingTime: 10000,
        difficulty: 3,
        successRate: 0.85,
      },
    ],

    mountainous: [
      {
        id: "mountain_pickaxe",
        name: "Pico de Montaña",
        description: "Pico reforzado especial para minar en montañas",
        output: { itemId: ItemId.MOUNTAIN_PICKAXE, quantity: 1 },
        ingredients: [
          { itemId: ItemId.IRON_ORE, quantity: 5 },
          { itemId: ItemId.MOUNTAIN_WOOD, quantity: 3 },
          { itemId: ItemId.RARE_GEMS, quantity: 1 },
        ],
        requirements: {
          workstation: WorkstationType.ANVIL,
          skill: "mining",
          skillLevel: 3,
        },
        craftingTime: 18000,
        difficulty: 6,
        successRate: 0.75,
      },
      {
        id: "gem_jewelry",
        name: "Joyería de Gemas",
        description: "Ornamento valioso hecho con gemas raras",
        output: { itemId: ItemId.GEM_NECKLACE, quantity: 1 },
        ingredients: [
          { itemId: ItemId.RARE_GEMS, quantity: 3 },
          { itemId: ItemId.COPPER_INGOT, quantity: 2 },
        ],
        requirements: {
          skill: "jewelcrafting",
          skillLevel: 2,
        },
        craftingTime: 15000,
        difficulty: 5,
        successRate: 0.8,
      },
      {
        id: "reinforced_rope",
        name: "Cuerda Reforzada",
        description: "Cuerda extra fuerte para escalada",
        output: { itemId: ItemId.CLIMBING_ROPE, quantity: 1 },
        ingredients: [
          { itemId: ItemId.FIBER, quantity: 8 },
          { itemId: ItemId.MOUNTAIN_WOOD, quantity: 2 },
        ],
        craftingTime: 8000,
        difficulty: 3,
        successRate: 0.9,
      },
    ],

    forest: [
      {
        id: "healing_salve",
        name: "Ungüento Curativo",
        description: "Bálsamo que acelera la curación de heridas",
        output: { itemId: ItemId.HEALING_SALVE, quantity: 2 },
        ingredients: [
          { itemId: ItemId.MEDICINAL_HERBS, quantity: 4 },
          { itemId: ItemId.HONEY, quantity: 1 },
          { itemId: ItemId.PINE_RESIN, quantity: 2 },
        ],
        requirements: {
          skill: SkillType.HERBALISM,
          skillLevel: 2,
        },
        craftingTime: 10000,
        difficulty: 4,
        successRate: 0.85,
      },
      {
        id: "honey_bread",
        name: "Pan de Miel",
        description: "Pan dulce y nutritivo",
        output: { itemId: ItemId.HONEY_BREAD, quantity: 2 },
        ingredients: [
          { itemId: ItemId.FLOUR, quantity: 3 },
          { itemId: ItemId.HONEY, quantity: 2 },
          { itemId: ItemId.WATER, quantity: 1 },
        ],
        requirements: {
          workstation: WorkstationType.OVEN,
        },
        craftingTime: 12000,
        difficulty: 2,
        successRate: 0.95,
      },
      {
        id: "pine_torch",
        name: "Antorcha de Pino",
        description: "Antorcha que arde más tiempo",
        output: { itemId: ItemId.PINE_TORCH, quantity: 3 },
        ingredients: [
          { itemId: ItemId.WOOD_LOG, quantity: 2 },
          { itemId: ItemId.PINE_RESIN, quantity: 1 },
          { itemId: ItemId.FIBER, quantity: 1 },
        ],
        craftingTime: 5000,
        difficulty: 2,
        successRate: 1.0,
      },
    ],

    grassland: [
      {
        id: "cotton_cloth",
        name: "Tela de Algodón",
        description: "Tela suave y cómoda de alta calidad",
        output: { itemId: ItemId.COTTON_CLOTH, quantity: 2 },
        ingredients: [{ itemId: ItemId.COTTON, quantity: 6 }],
        requirements: {
          workstation: WorkstationType.LOOM,
        },
        craftingTime: 8000,
        difficulty: 3,
        successRate: 0.9,
      },
      {
        id: "flower_dye",
        name: "Tinte de Flores",
        description: "Tinte natural para teñir telas",
        output: { itemId: ItemId.FLOWER_DYE, quantity: 3 },
        ingredients: [
          { itemId: ItemId.WILDFLOWERS, quantity: 10 },
          { itemId: ItemId.WATER, quantity: 2 },
        ],
        craftingTime: 6000,
        difficulty: 2,
        successRate: 0.95,
      },
      {
        id: "wheat_beer",
        name: "Cerveza de Trigo",
        description: "Bebida fermentada que restaura moral",
        output: { itemId: ItemId.WHEAT_BEER, quantity: 2 },
        ingredients: [
          { itemId: ItemId.WHEAT, quantity: 5 },
          { itemId: ItemId.WATER, quantity: 3 },
          { itemId: ItemId.HONEY, quantity: 1 },
        ],
        requirements: {
          workstation: WorkstationType.BREWING_BARREL,
        },
        craftingTime: 20000,
        difficulty: 4,
        successRate: 0.8,
      },
    ],

    village: [
      {
        id: "recycled_tools",
        name: "Herramientas Recicladas",
        description: "Herramientas hechas con chatarra",
        output: { itemId: ItemId.SCRAP_TOOL, quantity: 1 },
        ingredients: [
          { itemId: ItemId.SCRAP_METAL, quantity: 5 },
          { itemId: ItemId.OLD_TOOLS, quantity: 2 },
          { itemId: ItemId.FIBER, quantity: 3 },
        ],
        craftingTime: 8000,
        difficulty: 3,
        successRate: 0.85,
      },
      {
        id: "cultivated_seeds",
        name: "Semillas Cultivadas",
        description: "Semillas mejoradas para agricultura",
        output: { itemId: ItemId.QUALITY_SEEDS, quantity: 5 },
        ingredients: [
          { itemId: ItemId.SEEDS, quantity: 10 },
          { itemId: ItemId.WHEAT, quantity: 3 },
        ],
        craftingTime: 15000,
        difficulty: 4,
        successRate: 0.8,
      },
      {
        id: "community_meal",
        name: "Comida Comunitaria",
        description: "Gran cantidad de comida para compartir",
        output: { itemId: ItemId.COMMUNITY_MEAL, quantity: 1 },
        ingredients: [
          { itemId: ItemId.BREAD, quantity: 3 },
          { itemId: ItemId.COOKED_MEAT, quantity: 2 },
          { itemId: ItemId.BERRIES, quantity: 5 },
        ],
        craftingTime: 10000,
        difficulty: 2,
        successRate: 0.95,
      },
    ],
  };

  static getRecipesForBiome(biome: string): CraftingRecipe[] {
    return this.biomeRecipes[biome.toLowerCase()] || [];
  }

  static getRecipeById(recipeId: string): CraftingRecipe | null {
    for (const recipes of Object.values(this.biomeRecipes)) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (recipe) return recipe;
    }
    return null;
  }

  static isBiomeSpecific(recipeId: string): boolean {
    return this.getRecipeById(recipeId) !== null;
  }

  static getBiomeForRecipe(recipeId: string): string | null {
    for (const [biome, recipes] of Object.entries(this.biomeRecipes)) {
      if (recipes.some((r) => r.id === recipeId)) {
        return biome;
      }
    }
    return null;
  }

  static getAllBiomeRecipes(): CraftingRecipe[] {
    return Object.values(this.biomeRecipes).flat();
  }

  static getRecipeCountByBiome(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [biome, recipes] of Object.entries(this.biomeRecipes)) {
      counts[biome] = recipes.length;
    }
    return counts;
  }

  static getAvailableBiomes(): string[] {
    return Object.keys(this.biomeRecipes);
  }

  static getDiscoverableRecipes(
    biome: string,
    alreadyKnown: string[],
  ): CraftingRecipe[] {
    const biomeRecipes = this.getRecipesForBiome(biome);
    return biomeRecipes.filter((recipe) => !alreadyKnown.includes(recipe.id));
  }
}
