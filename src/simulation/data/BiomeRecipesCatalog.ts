import type { CraftingRecipe } from "../../domain/types/simulation/crafting";

export class BiomeRecipesCatalog {
  private static readonly biomeRecipes: Record<string, CraftingRecipe[]> = {
    mystical: [
      {
        id: "mystical_potion",
        name: "Poción Mística",
        description: "Una poción brillante con propiedades místicas",
        output: { itemId: "mystical_potion", quantity: 1 },
        ingredients: [
          { itemId: "mushroom_mystical", quantity: 3 },
          { itemId: "glowing_crystal", quantity: 1 },
          { itemId: "water", quantity: 2 },
        ],
        requirements: {
          workstation: "alchemy_table",
        },
        craftingTime: 15000,
        difficulty: 6,
        successRate: 0.7,
      },
      {
        id: "crystal_tool",
        name: "Herramienta de Cristal",
        description: "Una herramienta mística que nunca se desgasta",
        output: { itemId: "crystal_pickaxe", quantity: 1 },
        ingredients: [
          { itemId: "glowing_crystal", quantity: 5 },
          { itemId: "mystical_fiber", quantity: 3 },
          { itemId: "plank", quantity: 2 },
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
        output: { itemId: "energy_crystal", quantity: 1 },
        ingredients: [
          { itemId: "glowing_crystal", quantity: 3 },
          { itemId: "mushroom_mystical", quantity: 2 },
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
        output: { itemId: "swamp_antidote", quantity: 2 },
        ingredients: [
          { itemId: "swamp_herb", quantity: 3 },
          { itemId: "clay", quantity: 1 },
          { itemId: "water", quantity: 2 },
        ],
        requirements: {
          skill: "herbalism",
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
        output: { itemId: "reed_basket", quantity: 1 },
        ingredients: [
          { itemId: "reeds", quantity: 10 },
          { itemId: "fiber", quantity: 5 },
        ],
        craftingTime: 12000,
        difficulty: 3,
        successRate: 0.9,
      },
      {
        id: "clay_pottery",
        name: "Cerámica de Arcilla",
        description: "Vasija para almacenar agua y alimentos",
        output: { itemId: "clay_pot", quantity: 1 },
        ingredients: [
          { itemId: "clay", quantity: 5 },
          { itemId: "water", quantity: 2 },
        ],
        requirements: {
          workstation: "kiln",
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
        output: { itemId: "mountain_pickaxe", quantity: 1 },
        ingredients: [
          { itemId: "iron_ore", quantity: 5 },
          { itemId: "mountain_wood", quantity: 3 },
          { itemId: "rare_gems", quantity: 1 },
        ],
        requirements: {
          workstation: "anvil",
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
        output: { itemId: "gem_necklace", quantity: 1 },
        ingredients: [
          { itemId: "rare_gems", quantity: 3 },
          { itemId: "copper_ingot", quantity: 2 },
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
        output: { itemId: "climbing_rope", quantity: 1 },
        ingredients: [
          { itemId: "fiber", quantity: 8 },
          { itemId: "mountain_wood", quantity: 2 },
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
        output: { itemId: "healing_salve", quantity: 2 },
        ingredients: [
          { itemId: "medicinal_herbs", quantity: 4 },
          { itemId: "honey", quantity: 1 },
          { itemId: "pine_resin", quantity: 2 },
        ],
        requirements: {
          skill: "herbalism",
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
        output: { itemId: "honey_bread", quantity: 2 },
        ingredients: [
          { itemId: "flour", quantity: 3 },
          { itemId: "honey", quantity: 2 },
          { itemId: "water", quantity: 1 },
        ],
        requirements: {
          workstation: "oven",
        },
        craftingTime: 12000,
        difficulty: 2,
        successRate: 0.95,
      },
      {
        id: "pine_torch",
        name: "Antorcha de Pino",
        description: "Antorcha que arde más tiempo",
        output: { itemId: "pine_torch", quantity: 3 },
        ingredients: [
          { itemId: "wood_log", quantity: 2 },
          { itemId: "pine_resin", quantity: 1 },
          { itemId: "fiber", quantity: 1 },
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
        output: { itemId: "cotton_cloth", quantity: 2 },
        ingredients: [{ itemId: "cotton", quantity: 6 }],
        requirements: {
          workstation: "loom",
        },
        craftingTime: 8000,
        difficulty: 3,
        successRate: 0.9,
      },
      {
        id: "flower_dye",
        name: "Tinte de Flores",
        description: "Tinte natural para teñir telas",
        output: { itemId: "flower_dye", quantity: 3 },
        ingredients: [
          { itemId: "wildflowers", quantity: 10 },
          { itemId: "water", quantity: 2 },
        ],
        craftingTime: 6000,
        difficulty: 2,
        successRate: 0.95,
      },
      {
        id: "wheat_beer",
        name: "Cerveza de Trigo",
        description: "Bebida fermentada que restaura moral",
        output: { itemId: "wheat_beer", quantity: 2 },
        ingredients: [
          { itemId: "wheat", quantity: 5 },
          { itemId: "water", quantity: 3 },
          { itemId: "honey", quantity: 1 },
        ],
        requirements: {
          workstation: "brewing_barrel",
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
        output: { itemId: "scrap_tool", quantity: 1 },
        ingredients: [
          { itemId: "scrap_metal", quantity: 5 },
          { itemId: "old_tools", quantity: 2 },
          { itemId: "fiber", quantity: 3 },
        ],
        craftingTime: 8000,
        difficulty: 3,
        successRate: 0.85,
      },
      {
        id: "cultivated_seeds",
        name: "Semillas Cultivadas",
        description: "Semillas mejoradas para agricultura",
        output: { itemId: "quality_seeds", quantity: 5 },
        ingredients: [
          { itemId: "seeds", quantity: 10 },
          { itemId: "wheat", quantity: 3 },
        ],
        craftingTime: 15000,
        difficulty: 4,
        successRate: 0.8,
      },
      {
        id: "community_meal",
        name: "Comida Comunitaria",
        description: "Gran cantidad de comida para compartir",
        output: { itemId: "community_meal", quantity: 1 },
        ingredients: [
          { itemId: "bread", quantity: 3 },
          { itemId: "cooked_meat", quantity: 2 },
          { itemId: "berries", quantity: 5 },
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

  static getDiscoverableRecipes(
    biome: string,
    alreadyKnown: string[],
  ): CraftingRecipe[] {
    const biomeRecipes = this.getRecipesForBiome(biome);
    return biomeRecipes.filter((recipe) => !alreadyKnown.includes(recipe.id));
  }
}
