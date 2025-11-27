/**
 * Catalog of crafting recipes available in the game.
 *
 * Contains all recipes for transforming materials and creating items.
 * Used by crafting systems to determine what can be crafted and with what ingredients.
 *
 * @module simulation/data/RecipesCatalog
 */

import type { CraftingRecipe } from "../../domain/types/simulation/crafting";
import { ItemId } from "../../shared/constants/ItemEnums";
import { RecipeId } from "../../shared/constants/RecipeEnums";
import {
  WorkstationType,
  ToolType,
  SkillType,
} from "../../shared/constants/CraftingEnums";

/**
 * Static catalog of crafting recipes.
 */
export class RecipesCatalog {
  private static readonly recipes: CraftingRecipe[] = [
    {
      id: RecipeId.WOOD_TO_PLANK,
      name: "Madera a Tablón",
      description: "Procesar troncos en tablones",
      output: { itemId: ItemId.PLANK, quantity: 4 },
      ingredients: [{ itemId: ItemId.WOOD_LOG, quantity: 1 }],
      craftingTime: 2000,
      difficulty: 1,
      successRate: 1.0,
    },
    {
      id: RecipeId.SMELT_IRON,
      name: "Fundir Hierro",
      description: "Fundir mineral de hierro en lingotes",
      output: { itemId: ItemId.IRON_INGOT, quantity: 1 },
      ingredients: [
        { itemId: ItemId.IRON_ORE, quantity: 2 },
        { itemId: ItemId.COAL, quantity: 1 },
      ],
      requirements: {
        workstation: WorkstationType.FURNACE,
      },
      craftingTime: 5000,
      difficulty: 3,
      successRate: 0.95,
    },
    {
      id: RecipeId.SMELT_COPPER,
      name: "Fundir Cobre",
      description: "Fundir mineral de cobre en lingotes",
      output: { itemId: ItemId.COPPER_INGOT, quantity: 1 },
      ingredients: [
        { itemId: ItemId.COPPER_ORE, quantity: 2 },
        { itemId: ItemId.COAL, quantity: 1 },
      ],
      requirements: {
        workstation: WorkstationType.FURNACE,
      },
      craftingTime: 4500,
      difficulty: 3,
      successRate: 0.95,
    },
    {
      id: RecipeId.TAN_LEATHER,
      name: "Curtir Cuero",
      description: "Procesar piel en cuero",
      output: { itemId: ItemId.LEATHER, quantity: 1 },
      ingredients: [
        { itemId: ItemId.LEATHER_HIDE, quantity: 1 },
        { itemId: ItemId.WATER, quantity: 3 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: RecipeId.WEAVE_CLOTH,
      name: "Tejer Tela",
      description: "Tejer fibras en tela",
      output: { itemId: ItemId.CLOTH, quantity: 1 },
      ingredients: [{ itemId: ItemId.FIBER, quantity: 5 }],
      requirements: {
        workstation: WorkstationType.LOOM,
      },
      craftingTime: 6000,
      difficulty: 2,
      successRate: 0.92,
    },
    {
      id: RecipeId.MAKE_ROPE,
      name: "Hacer Cuerda",
      description: "Trenzar fibras en cuerda",
      output: { itemId: ItemId.ROPE, quantity: 1 },
      ingredients: [{ itemId: ItemId.FIBER, quantity: 3 }],
      craftingTime: 3000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: RecipeId.FIRE_BRICK,
      name: "Cocer Ladrillos",
      description: "Cocinar arcilla para hacer ladrillos",
      output: { itemId: ItemId.BRICK, quantity: 4 },
      ingredients: [
        { itemId: ItemId.CLAY, quantity: 2 },
        { itemId: ItemId.COAL, quantity: 1 },
      ],
      requirements: {
        workstation: WorkstationType.KILN,
      },
      craftingTime: 10000,
      difficulty: 2,
      successRate: 0.9,
    },

    {
      id: RecipeId.GRIND_WHEAT,
      name: "Moler Trigo",
      description: "Moler trigo en harina",
      output: { itemId: ItemId.FLOUR, quantity: 2 },
      ingredients: [{ itemId: ItemId.WHEAT, quantity: 3 }],
      requirements: {
        tool: ToolType.MORTAR,
      },
      craftingTime: 4000,
      difficulty: 1,
      successRate: 1.0,
    },
    {
      id: RecipeId.BAKE_BREAD,
      name: "Hornear Pan",
      description: "Hornear pan con harina",
      output: { itemId: ItemId.BREAD, quantity: 2 },
      ingredients: [
        { itemId: ItemId.FLOUR, quantity: 3 },
        { itemId: ItemId.WATER, quantity: 1 },
      ],
      requirements: {
        workstation: WorkstationType.OVEN,
      },
      craftingTime: 12000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: RecipeId.COOK_MEAT,
      name: "Cocinar Carne",
      description: "Cocinar carne cruda",
      output: { itemId: ItemId.COOKED_MEAT, quantity: 1 },
      ingredients: [{ itemId: ItemId.RAW_MEAT, quantity: 1 }],
      requirements: {
        workstation: WorkstationType.CAMPFIRE,
      },
      craftingTime: 5000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: RecipeId.COOK_FISH,
      name: "Cocinar Pescado",
      description: "Cocinar pescado",
      output: { itemId: ItemId.COOKED_FISH, quantity: 1 },
      ingredients: [{ itemId: ItemId.FISH, quantity: 1 }],
      requirements: {
        workstation: WorkstationType.CAMPFIRE,
      },
      craftingTime: 4000,
      difficulty: 1,
      successRate: 0.95,
    },
    {
      id: RecipeId.MAKE_STEW,
      name: "Hacer Estofado",
      description: "Combinar ingredientes en estofado",
      output: { itemId: ItemId.MEAT_STEW, quantity: 1 },
      ingredients: [
        { itemId: ItemId.COOKED_MEAT, quantity: 1 },
        { itemId: ItemId.BERRIES, quantity: 3 },
        { itemId: ItemId.WATER, quantity: 2 },
      ],
      requirements: {
        workstation: WorkstationType.COOKING_POT,
      },
      craftingTime: 15000,
      difficulty: 3,
      successRate: 0.85,
    },

    {
      id: RecipeId.STONE_AXE,
      name: "Hacer Hacha de Piedra",
      description: "Fabricar hacha básica",
      output: { itemId: ItemId.STONE_AXE, quantity: 1 },
      ingredients: [
        { itemId: ItemId.STONE, quantity: 3 },
        { itemId: ItemId.WOOD_LOG, quantity: 2 },
        { itemId: ItemId.FIBER, quantity: 2 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: RecipeId.STONE_PICKAXE,
      name: "Hacer Pico de Piedra",
      description: "Fabricar pico básico",
      output: { itemId: ItemId.STONE_PICKAXE, quantity: 1 },
      ingredients: [
        { itemId: ItemId.STONE, quantity: 4 },
        { itemId: ItemId.WOOD_LOG, quantity: 2 },
        { itemId: ItemId.FIBER, quantity: 2 },
      ],
      craftingTime: 8000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: RecipeId.IRON_AXE,
      name: "Forjar Hacha de Hierro",
      description: "Forjar hacha avanzada",
      output: { itemId: ItemId.IRON_AXE, quantity: 1 },
      ingredients: [
        { itemId: ItemId.IRON_INGOT, quantity: 3 },
        { itemId: ItemId.PLANK, quantity: 2 },
      ],
      requirements: {
        workstation: WorkstationType.ANVIL,
        skill: SkillType.SMITHING,
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 5,
      successRate: 0.8,
    },
    {
      id: RecipeId.IRON_PICKAXE,
      name: "Forjar Pico de Hierro",
      description: "Forjar pico avanzado",
      output: { itemId: ItemId.IRON_PICKAXE, quantity: 1 },
      ingredients: [
        { itemId: ItemId.IRON_INGOT, quantity: 3 },
        { itemId: ItemId.PLANK, quantity: 2 },
      ],
      requirements: {
        workstation: WorkstationType.ANVIL,
        skill: SkillType.SMITHING,
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 5,
      successRate: 0.8,
    },

    {
      id: RecipeId.WOODEN_CLUB,
      name: "Hacer Garrote",
      description: "Fabricar arma básica",
      output: { itemId: ItemId.WOODEN_CLUB, quantity: 1 },
      ingredients: [
        { itemId: ItemId.WOOD_LOG, quantity: 3 },
        { itemId: ItemId.FIBER, quantity: 1 },
      ],
      craftingTime: 6000,
      difficulty: 2,
      successRate: 0.95,
    },
    {
      id: RecipeId.STONE_DAGGER,
      name: "Hacer Daga de Piedra",
      description: "Fabricar daga básica",
      output: { itemId: ItemId.STONE_DAGGER, quantity: 1 },
      ingredients: [
        { itemId: ItemId.STONE, quantity: 2 },
        { itemId: ItemId.WOOD_LOG, quantity: 1 },
        { itemId: ItemId.FIBER, quantity: 2 },
      ],
      craftingTime: 7000,
      difficulty: 3,
      successRate: 0.9,
    },
    {
      id: RecipeId.IRON_SWORD,
      name: "Forjar Espada de Hierro",
      description: "Forjar espada de calidad",
      output: { itemId: ItemId.IRON_SWORD, quantity: 1 },
      ingredients: [
        { itemId: ItemId.IRON_INGOT, quantity: 4 },
        { itemId: ItemId.LEATHER, quantity: 1 },
      ],
      requirements: {
        workstation: WorkstationType.ANVIL,
        skill: SkillType.SMITHING,
        skillLevel: 3,
      },
      craftingTime: 20000,
      difficulty: 6,
      successRate: 0.75,
    },
    {
      id: RecipeId.BOW,
      name: "Hacer Arco",
      description: "Fabricar arco de madera",
      output: { itemId: ItemId.BOW, quantity: 1 },
      ingredients: [
        { itemId: ItemId.PLANK, quantity: 3 },
        { itemId: ItemId.FIBER, quantity: 5 },
      ],
      requirements: {
        skill: SkillType.CRAFTING,
        skillLevel: 2,
      },
      craftingTime: 12000,
      difficulty: 4,
      successRate: 0.85,
    },

    {
      id: RecipeId.CLOTH_SHIRT,
      name: "Coser Camisa",
      description: "Coser ropa básica",
      output: { itemId: ItemId.CLOTH_SHIRT, quantity: 1 },
      ingredients: [
        { itemId: ItemId.CLOTH, quantity: 3 },
        { itemId: ItemId.FIBER, quantity: 2 },
      ],
      requirements: {
        tool: ToolType.NEEDLE,
      },
      craftingTime: 10000,
      difficulty: 2,
      successRate: 0.9,
    },
    {
      id: RecipeId.LEATHER_VEST,
      name: "Hacer Chaleco de Cuero",
      description: "Fabricar armadura ligera",
      output: { itemId: ItemId.LEATHER_VEST, quantity: 1 },
      ingredients: [
        { itemId: ItemId.LEATHER, quantity: 4 },
        { itemId: ItemId.FIBER, quantity: 3 },
      ],
      requirements: {
        tool: ToolType.NEEDLE,
        skill: SkillType.LEATHERWORKING,
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
      output: { itemId: ItemId.IRON_HELMET, quantity: 1 },
      ingredients: [{ itemId: ItemId.IRON_INGOT, quantity: 5 }],
      requirements: {
        workstation: WorkstationType.ANVIL,
        skill: SkillType.SMITHING,
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
      output: { itemId: ItemId.WOODEN_FRAME, quantity: 1 },
      ingredients: [
        { itemId: ItemId.PLANK, quantity: 8 },
        { itemId: ItemId.ROPE, quantity: 4 },
      ],
      craftingTime: 20000,
      difficulty: 3,
      successRate: 0.9,
    },
    {
      id: "stone_foundation",
      name: "Construir Cimientos",
      description: "Crear base de piedra sólida",
      output: { itemId: ItemId.STONE_FOUNDATION, quantity: 1 },
      ingredients: [
        { itemId: ItemId.STONE, quantity: 20 },
        { itemId: ItemId.CLAY, quantity: 5 },
      ],
      craftingTime: 30000,
      difficulty: 4,
      successRate: 0.85,
    },
    {
      id: "door",
      name: "Hacer Puerta",
      description: "Construir puerta funcional",
      output: { itemId: ItemId.DOOR, quantity: 1 },
      ingredients: [
        { itemId: ItemId.PLANK, quantity: 6 },
        { itemId: ItemId.IRON_INGOT, quantity: 2 },
      ],
      requirements: {
        skill: SkillType.CARPENTRY,
        skillLevel: 2,
      },
      craftingTime: 15000,
      difficulty: 4,
      successRate: 0.85,
    },
  ];

  private static dynamicRecipes: CraftingRecipe[] = [];

  static getAllRecipes(): CraftingRecipe[] {
    return [...this.recipes, ...this.dynamicRecipes];
  }

  static getRecipeById(id: string): CraftingRecipe | null {
    return (
      this.recipes.find((r) => r.id === id) ||
      this.dynamicRecipes.find((r) => r.id === id) ||
      null
    );
  }

  /**
   * Registra una receta de bioma para que esté disponible globalmente.
   * Evita duplicados.
   */
  static registerBiomeRecipe(recipe: CraftingRecipe): boolean {
    if (this.getRecipeById(recipe.id)) {
      return false;
    }
    this.dynamicRecipes.push(recipe);
    return true;
  }

  /**
   * Obtiene recetas dinámicas registradas (de biomas, etc.)
   */
  static getDynamicRecipes(): CraftingRecipe[] {
    return [...this.dynamicRecipes];
  }

  static getRecipesByOutput(itemId: string): CraftingRecipe[] {
    return this.getAllRecipes().filter((r) => r.output.itemId === itemId);
  }

  static getRecipesByDifficulty(
    minDiff: number,
    maxDiff: number,
  ): CraftingRecipe[] {
    return this.getAllRecipes().filter((r) => {
      const difficulty = r.difficulty ?? 1;
      return difficulty >= minDiff && difficulty <= maxDiff;
    });
  }

  static getRecipesRequiringWorkstation(workstation: string): CraftingRecipe[] {
    return this.getAllRecipes().filter(
      (r) => r.requirements?.workstation === workstation,
    );
  }

  static canCraftWith(availableItems: Map<string, number>): CraftingRecipe[] {
    return this.getAllRecipes().filter((recipe) => {
      return recipe.ingredients.every((ingredient) => {
        const available = availableItems.get(ingredient.itemId) || 0;
        return available >= ingredient.quantity;
      });
    });
  }
}
