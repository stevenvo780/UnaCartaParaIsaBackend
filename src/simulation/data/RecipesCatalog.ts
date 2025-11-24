import type { CraftingRecipe } from "../../domain/types/simulation/crafting";

export class RecipesCatalog {
  private static readonly recipes: CraftingRecipe[] = [
    {
      id: "wood_to_plank",
      name: "Madera a Tablón",
      description: "Procesar troncos en tablones",
      output: { itemId: "plank", quantity: 4 },
      ingredients: [{ itemId: "wood_log", quantity: 1 }],
      craftingTime: 2000,
      difficulty: 1,
      successRate: 1.0,
    },
    {
      id: "smelt_iron",
      name: "Fundir Hierro",
      description: "Fundir mineral de hierro en lingotes",
      output: { itemId: "iron_ingot", quantity: 1 },
      ingredients: [
        { itemId: "iron_ore", quantity: 2 },
        { itemId: "coal", quantity: 1 },
      ],
      requirements: {
        workstation: "furnace",
      },
      craftingTime: 5000,
      difficulty: 3,
      successRate: 0.95,
    },
    {
      id: "smelt_copper",
      name: "Fundir Cobre",
      description: "Fundir mineral de cobre en lingotes",
      output: { itemId: "copper_ingot", quantity: 1 },
      ingredients: [
        { itemId: "copper_ore", quantity: 2 },
        { itemId: "coal", quantity: 1 },
      ],
      requirements: {
        workstation: "furnace",
      },
      craftingTime: 4500,
      difficulty: 3,
      successRate: 0.95,
    },
    {
      id: "tan_leather",
      name: "Curtir Cuero",
      description: "Procesar piel en cuero",
      output: { itemId: "leather", quantity: 1 },
      ingredients: [
        { itemId: "leather_hide", quantity: 1 },
        { itemId: "water", quantity: 3 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: "weave_cloth",
      name: "Tejer Tela",
      description: "Tejer fibras en tela",
      output: { itemId: "cloth", quantity: 1 },
      ingredients: [{ itemId: "fiber", quantity: 5 }],
      requirements: {
        workstation: "loom",
      },
      craftingTime: 6000,
      difficulty: 2,
      successRate: 0.92,
    },
    {
      id: "make_rope",
      name: "Hacer Cuerda",
      description: "Trenzar fibras en cuerda",
      output: { itemId: "rope", quantity: 1 },
      ingredients: [{ itemId: "fiber", quantity: 3 }],
      craftingTime: 3000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: "fire_brick",
      name: "Cocer Ladrillos",
      description: "Cocinar arcilla para hacer ladrillos",
      output: { itemId: "brick", quantity: 4 },
      ingredients: [
        { itemId: "clay", quantity: 2 },
        { itemId: "coal", quantity: 1 },
      ],
      requirements: {
        workstation: "kiln",
      },
      craftingTime: 10000,
      difficulty: 2,
      successRate: 0.9,
    },

    {
      id: "grind_wheat",
      name: "Moler Trigo",
      description: "Moler trigo en harina",
      output: { itemId: "flour", quantity: 2 },
      ingredients: [{ itemId: "wheat", quantity: 3 }],
      requirements: {
        tool: "mortar",
      },
      craftingTime: 4000,
      difficulty: 1,
      successRate: 1.0,
    },
    {
      id: "bake_bread",
      name: "Hornear Pan",
      description: "Hornear pan con harina",
      output: { itemId: "bread", quantity: 2 },
      ingredients: [
        { itemId: "flour", quantity: 3 },
        { itemId: "water", quantity: 1 },
      ],
      requirements: {
        workstation: "oven",
      },
      craftingTime: 12000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: "cook_meat",
      name: "Cocinar Carne",
      description: "Cocinar carne cruda",
      output: { itemId: "cooked_meat", quantity: 1 },
      ingredients: [{ itemId: "raw_meat", quantity: 1 }],
      requirements: {
        workstation: "campfire",
      },
      craftingTime: 5000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: "cook_fish",
      name: "Cocinar Pescado",
      description: "Cocinar pescado",
      output: { itemId: "cooked_fish", quantity: 1 },
      ingredients: [{ itemId: "fish", quantity: 1 }],
      requirements: {
        workstation: "campfire",
      },
      craftingTime: 4000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: "make_stew",
      name: "Hacer Estofado",
      description: "Combinar ingredientes en estofado",
      output: { itemId: "meat_stew", quantity: 1 },
      ingredients: [
        { itemId: "cooked_meat", quantity: 1 },
        { itemId: "berries", quantity: 3 },
        { itemId: "water", quantity: 2 },
      ],
      requirements: {
        workstation: "cooking_pot",
      },
      craftingTime: 15000,
      difficulty: 3,
      successRate: 0.85,
    },

    {
      id: "stone_axe",
      name: "Hacer Hacha de Piedra",
      description: "Fabricar hacha básica",
      output: { itemId: "stone_axe", quantity: 1 },
      ingredients: [
        { itemId: "stone", quantity: 3 },
        { itemId: "wood_log", quantity: 2 },
        { itemId: "fiber", quantity: 2 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: "stone_pickaxe",
      name: "Hacer Pico de Piedra",
      description: "Fabricar pico básico",
      output: { itemId: "stone_pickaxe", quantity: 1 },
      ingredients: [
        { itemId: "stone", quantity: 4 },
        { itemId: "wood_log", quantity: 2 },
        { itemId: "fiber", quantity: 2 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: "iron_axe",
      name: "Forjar Hacha de Hierro",
      description: "Forjar hacha avanzada",
      output: { itemId: "iron_axe", quantity: 1 },
      ingredients: [
        { itemId: "iron_ingot", quantity: 3 },
        { itemId: "plank", quantity: 2 },
      ],
      requirements: {
        workstation: "anvil",
        skill: "smithing",
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 5,
      successRate: 0.8,
    },
    {
      id: "iron_pickaxe",
      name: "Forjar Pico de Hierro",
      description: "Forjar pico avanzado",
      output: { itemId: "iron_pickaxe", quantity: 1 },
      ingredients: [
        { itemId: "iron_ingot", quantity: 3 },
        { itemId: "plank", quantity: 2 },
      ],
      requirements: {
        workstation: "anvil",
        skill: "smithing",
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 5,
      successRate: 0.8,
    },

    {
      id: "wooden_club",
      name: "Hacer Garrote",
      description: "Fabricar arma básica",
      output: { itemId: "wooden_club", quantity: 1 },
      ingredients: [
        { itemId: "wood_log", quantity: 3 },
        { itemId: "fiber", quantity: 1 },
      ],
      craftingTime: 6000,
      difficulty: 2,
      successRate: 0.95,
    },
    {
      id: "stone_dagger",
      name: "Hacer Daga de Piedra",
      description: "Fabricar daga básica",
      output: { itemId: "stone_dagger", quantity: 1 },
      ingredients: [
        { itemId: "stone", quantity: 2 },
        { itemId: "wood_log", quantity: 1 },
        { itemId: "fiber", quantity: 2 },
      ],
      craftingTime: 7000,
      difficulty: 3,
      successRate: 0.9,
    },
    {
      id: "iron_sword",
      name: "Forjar Espada de Hierro",
      description: "Forjar espada de calidad",
      output: { itemId: "iron_sword", quantity: 1 },
      ingredients: [
        { itemId: "iron_ingot", quantity: 4 },
        { itemId: "leather", quantity: 1 },
      ],
      requirements: {
        workstation: "anvil",
        skill: "smithing",
        skillLevel: 3,
      },
      craftingTime: 20000,
      difficulty: 6,
      successRate: 0.75,
    },
    {
      id: "bow",
      name: "Hacer Arco",
      description: "Fabricar arco de madera",
      output: { itemId: "bow", quantity: 1 },
      ingredients: [
        { itemId: "plank", quantity: 3 },
        { itemId: "fiber", quantity: 5 },
      ],
      requirements: {
        skill: "crafting",
        skillLevel: 2,
      },
      craftingTime: 12000,
      difficulty: 4,
      successRate: 0.85,
    },

    {
      id: "cloth_shirt",
      name: "Coser Camisa",
      description: "Coser ropa básica",
      output: { itemId: "cloth_shirt", quantity: 1 },
      ingredients: [
        { itemId: "cloth", quantity: 3 },
        { itemId: "fiber", quantity: 2 },
      ],
      requirements: {
        tool: "needle",
      },
      craftingTime: 10000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: "leather_vest",
      name: "Hacer Chaleco de Cuero",
      description: "Fabricar armadura ligera",
      output: { itemId: "leather_vest", quantity: 1 },
      ingredients: [
        { itemId: "leather", quantity: 4 },
        { itemId: "fiber", quantity: 3 },
      ],
      requirements: {
        tool: "needle",
        skill: "leatherworking",
        skillLevel: 2,
      },
      craftingTime: 18000,
      difficulty: 4,
      successRate: 0.8,
    },
    {
      id: "iron_helmet",
      name: "Forjar Casco de Hierro",
      description: "Forjar protección para cabeza",
      output: { itemId: "iron_helmet", quantity: 1 },
      ingredients: [{ itemId: "iron_ingot", quantity: 5 }],
      requirements: {
        workstation: "anvil",
        skill: "smithing",
        skillLevel: 3,
      },
      craftingTime: 16000,
      difficulty: 5,
      successRate: 0.8,
    },

    {
      id: "wooden_frame",
      name: "Construir Marco de Madera",
      description: "Ensamblar estructura básica",
      output: { itemId: "wooden_frame", quantity: 1 },
      ingredients: [
        { itemId: "plank", quantity: 8 },
        { itemId: "rope", quantity: 4 },
      ],
      craftingTime: 20000,
      difficulty: 3,
      successRate: 0.9,
    },
    {
      id: "stone_foundation",
      name: "Construir Cimientos",
      description: "Crear base de piedra sólida",
      output: { itemId: "stone_foundation", quantity: 1 },
      ingredients: [
        { itemId: "stone", quantity: 20 },
        { itemId: "clay", quantity: 5 },
      ],
      craftingTime: 30000,
      difficulty: 4,
      successRate: 0.85,
    },
    {
      id: "door",
      name: "Hacer Puerta",
      description: "Construir puerta funcional",
      output: { itemId: "door", quantity: 1 },
      ingredients: [
        { itemId: "plank", quantity: 6 },
        { itemId: "iron_ingot", quantity: 2 },
      ],
      requirements: {
        skill: "carpentry",
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 4,
      successRate: 0.85,
    },
  ];

  static getAllRecipes(): CraftingRecipe[] {
    return [...this.recipes];
  }

  static getRecipeById(id: string): CraftingRecipe | null {
    return this.recipes.find((r) => r.id === id) || null;
  }

  static getRecipesByOutput(itemId: string): CraftingRecipe[] {
    return this.recipes.filter((r) => r.output.itemId === itemId);
  }

  static getRecipesByDifficulty(
    minDiff: number,
    maxDiff: number,
  ): CraftingRecipe[] {
    return this.recipes.filter(
      (r) => (r.difficulty || 1) >= minDiff && (r.difficulty || 1) <= maxDiff,
    );
  }

  static getRecipesRequiringWorkstation(workstation: string): CraftingRecipe[] {
    return this.recipes.filter(
      (r) => r.requirements?.workstation === workstation,
    );
  }

  static canCraftWith(availableItems: Map<string, number>): CraftingRecipe[] {
    return this.recipes.filter((recipe) => {
      return recipe.ingredients.every((ingredient) => {
        const available = availableItems.get(ingredient.itemId) || 0;
        return available >= ingredient.quantity;
      });
    });
  }
}
