import type { ResearchCategory } from "../../domain/types/simulation/research";

export class ResearchTreeCatalog {
  private static readonly categories: Record<string, ResearchCategory> = {
    basic_survival: {
      id: "basic_survival",
      name: "Supervivencia Básica",
      description:
        "Conocimientos fundamentales para sobrevivir: cocinar, hacer fuego y herramientas primitivas",
      prerequisites: [],
      recipes: ["cook_meat", "cook_fish", "make_rope", "wooden_club"],
      level: 1,
      icon: "🔥",
    },

    woodworking: {
      id: "woodworking",
      name: "Carpintería",
      description:
        "El arte de trabajar la madera para crear estructuras y herramientas",
      prerequisites: ["basic_survival"],
      recipes: ["wood_to_plank", "wooden_frame", "bow", "door"],
      level: 2,
      icon: "🪓",
    },

    primitive_tools: {
      id: "primitive_tools",
      name: "Herramientas Primitivas",
      description: "Fabricación de herramientas básicas de piedra y madera",
      prerequisites: ["basic_survival"],
      recipes: ["stone_axe", "stone_pickaxe", "stone_dagger"],
      level: 2,
      icon: "🔨",
    },

    textile_crafts: {
      id: "textile_crafts",
      name: "Artesanía Textil",
      description: "Tejido de fibras y creación de telas y cuerdas",
      prerequisites: ["basic_survival"],
      recipes: ["weave_cloth", "cloth_shirt"],
      level: 2,
      icon: "🧵",
    },

    metallurgy: {
      id: "metallurgy",
      name: "Metalurgia",
      description: "Fundición de minerales y forja de metales",
      prerequisites: ["primitive_tools", "woodworking"],
      recipes: ["smelt_iron", "smelt_copper", "iron_axe", "iron_pickaxe"],
      level: 3,
      icon: "⚒️",
    },

    leatherworking: {
      id: "leatherworking",
      name: "Marroquinería",
      description: "Curtido de pieles y creación de artículos de cuero",
      prerequisites: ["textile_crafts"],
      recipes: ["tan_leather", "leather_vest"],
      level: 3,
      icon: "🛡️",
    },

    cooking_advanced: {
      id: "cooking_advanced",
      name: "Cocina Avanzada",
      description:
        "Técnicas culinarias complejas y preparación de alimentos nutritivos",
      prerequisites: ["basic_survival"],
      recipes: ["grind_wheat", "bake_bread", "make_stew"],
      level: 3,
      icon: "🍲",
    },

    masonry: {
      id: "masonry",
      name: "Albañilería",
      description: "Trabajo con piedra y arcilla para construcción",
      prerequisites: ["primitive_tools"],
      recipes: ["fire_brick", "stone_foundation"],
      level: 3,
      icon: "🏗️",
    },

    blacksmithing: {
      id: "blacksmithing",
      name: "Herrería",
      description: "Maestría en la forja de armas y armaduras de metal",
      prerequisites: ["metallurgy", "leatherworking"],
      recipes: ["iron_sword", "iron_helmet"],
      level: 4,
      icon: "⚔️",
    },

    advanced_construction: {
      id: "advanced_construction",
      name: "Construcción Avanzada",
      description: "Técnicas complejas de construcción y arquitectura",
      prerequisites: ["woodworking", "masonry"],
      recipes: ["wooden_frame", "stone_foundation", "door"],
      level: 4,
      icon: "🏛️",
    },

    engineering: {
      id: "engineering",
      name: "Ingeniería",
      description: "Diseño y construcción de mecanismos complejos",
      prerequisites: ["advanced_construction", "blacksmithing"],
      recipes: [],
      level: 5,
      icon: "⚙️",
    },

    alchemy: {
      id: "alchemy",
      name: "Alquimia",
      description: "Transformación de materiales y creación de pociones",
      prerequisites: ["cooking_advanced", "metallurgy"],
      recipes: [],
      level: 5,
      icon: "⚗️",
    },
  };

  static getAllCategories(): ResearchCategory[] {
    return Object.values(this.categories);
  }

  static getCategory(categoryId: string): ResearchCategory | null {
    return this.categories[categoryId] || null;
  }

  static getCategoriesByLevel(level: number): ResearchCategory[] {
    return Object.values(this.categories).filter((cat) => cat.level === level);
  }

  static isCategoryAvailable(
    categoryId: string,
    unlockedCategories: string[],
  ): boolean {
    const category = this.categories[categoryId];
    if (!category) return false;

    return category.prerequisites.every((prereq) =>
      unlockedCategories.includes(prereq),
    );
  }

  static getCategoryForRecipe(recipeId: string): ResearchCategory | null {
    return (
      Object.values(this.categories).find((cat) =>
        cat.recipes.includes(recipeId),
      ) || null
    );
  }

  static getAvailableCategories(
    unlockedCategories: string[],
  ): ResearchCategory[] {
    return Object.values(this.categories).filter(
      (cat) =>
        !unlockedCategories.includes(cat.id) &&
        this.isCategoryAvailable(cat.id, unlockedCategories),
    );
  }

  static calculateResearchProgress(unlockedCategories: string[]): number {
    const totalCategories = Object.keys(this.categories).length;
    return unlockedCategories.length / totalCategories;
  }

  static getUnlockedBy(categoryId: string): ResearchCategory[] {
    return Object.values(this.categories).filter((cat) =>
      cat.prerequisites.includes(categoryId),
    );
  }

  static getDependencyPath(categoryId: string): string[] {
    const category = this.categories[categoryId];
    if (!category) return [];

    const path: string[] = [];
    const visited = new Set<string>();

    const traverse = (catId: string): void => {
      if (visited.has(catId)) return;
      visited.add(catId);

      const cat = this.categories[catId];
      if (!cat) return;

      cat.prerequisites.forEach((prereq) => {
        traverse(prereq);
      });

      path.push(catId);
    };

    traverse(categoryId);
    return path;
  }

  static suggestNextCategories(
    unlockedCategories: string[],
    limit = 3,
  ): ResearchCategory[] {
    const available = this.getAvailableCategories(unlockedCategories);

    return available.sort((a, b) => a.level - b.level).slice(0, limit);
  }

  static getResearchStats(unlockedCategories: string[]): {
    totalCategories: number;
    unlockedCategories: number;
    byLevel: Record<number, { total: number; unlocked: number }>;
    progress: number;
  } {
    const totalCategories = Object.keys(this.categories).length;
    const byLevel: Record<number, { total: number; unlocked: number }> = {};

    for (let i = 1; i <= 5; i++) {
      byLevel[i] = { total: 0, unlocked: 0 };
    }

    Object.values(this.categories).forEach((cat) => {
      byLevel[cat.level].total++;
      if (unlockedCategories.includes(cat.id)) {
        byLevel[cat.level].unlocked++;
      }
    });

    return {
      totalCategories,
      unlockedCategories: unlockedCategories.length,
      byLevel,
      progress: this.calculateResearchProgress(unlockedCategories),
    };
  }
}
