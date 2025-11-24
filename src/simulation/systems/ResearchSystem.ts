import { GameState } from "../../types/game-types.js";
import {
  ResearchNode,
  ResearchCategory,
  LineageResearchStats,
  TechTreeState,
} from "../types/research.js";

// Simplified catalog - in production would be loaded from data files
const RESEARCH_CATEGORIES: ResearchCategory[] = [
  {
    id: "basic_survival",
    name: "Basic Survival",
    description: "Essential survival skills",
    prerequisites: [],
    recipes: ["cook_meat", "cook_fish", "make_rope", "wooden_club"],
    tier: 1,
  },
  {
    id: "woodworking",
    name: "Woodworking",
    description: "Working with wood",
    prerequisites: ["basic_survival"],
    recipes: ["wood_to_plank", "wooden_spear", "wooden_bowl", "wooden_axe"],
    tier: 2,
  },
  {
    id: "stonecraft",
    name: "Stonecraft",
    description: "Working with stone",
    prerequisites: ["basic_survival"],
    recipes: ["stone_axe", "stone_hammer", "grinding_stone", "stone_knife"],
    tier: 2,
  },
  {
    id: "agriculture",
    name: "Agriculture",
    description: "Farming and cultivation",
    prerequisites: ["woodworking"],
    recipes: ["wooden_hoe", "seed_bag", "irrigation_channel", "storage_pit"],
    tier: 3,
  },
  {
    id: "metallurgy",
    name: "Metallurgy",
    description: "Working with metals",
    prerequisites: ["stonecraft"],
    recipes: ["forge", "bronze_ingot", "iron_ingot", "metal_tools"],
    tier: 3,
  },
];

export class ResearchSystem {
  private gameState: GameState;
  private lineageResearch = new Map<string, Map<string, ResearchNode>>();
  private unlockedCategories = new Map<string, Set<string>>();
  private lineageSpecializations = new Map<string, string[]>();

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public initializeLineage(lineageId: string): void {
    this.lineageResearch.set(lineageId, new Map());
    this.unlockedCategories.set(lineageId, new Set(["basic_survival"]));
    this.lineageSpecializations.set(lineageId, []);
    this.unlockCategory(lineageId, "basic_survival");
  }

  public onRecipeDiscovered(
    lineageId: string,
    recipeId: string,
    discoveredBy: string
  ): { completed: boolean; unlocked: string[] } {
    const category = this.getCategoryForRecipe(recipeId);
    if (!category) return { completed: false, unlocked: [] };

    const researchMap = this.lineageResearch.get(lineageId);
    if (!researchMap) {
      this.initializeLineage(lineageId);
      return this.onRecipeDiscovered(lineageId, recipeId, discoveredBy);
    }

    let node = researchMap.get(category.id);

    if (!node) {
      node = {
        categoryId: category.id,
        unlockedAt: Date.now(),
        progress: 0,
        recipesDiscovered: [],
        contributors: [],
      };
      researchMap.set(category.id, node);
    }

    const result = { completed: false, unlocked: [] as string[] };

    if (!node.recipesDiscovered.includes(recipeId)) {
      node.recipesDiscovered.push(recipeId);
      node.progress = node.recipesDiscovered.length / category.recipes.length;

      if (!node.contributors.includes(discoveredBy)) {
        node.contributors.push(discoveredBy);
      }

      if (node.progress >= 1.0) {
        result.completed = true;
        result.unlocked = this.onCategoryCompleted(lineageId, category.id);
      }

      this.evaluateSpecialization(lineageId);
    }

    return result;
  }

  private getCategoryForRecipe(recipeId: string): ResearchCategory | undefined {
    return RESEARCH_CATEGORIES.find((cat) => cat.recipes.includes(recipeId));
  }

  private onCategoryCompleted(lineageId: string, categoryId: string): string[] {
    const unlocked = this.unlockedCategories.get(lineageId);
    if (!unlocked) return [];

    unlocked.add(categoryId);

    const newlyUnlocked: string[] = [];
    const nextCategories = this.getUnlockedBy(categoryId);

    nextCategories.forEach((nextCat) => {
      if (this.unlockCategory(lineageId, nextCat.id)) {
        newlyUnlocked.push(nextCat.id);
      }
    });

    return newlyUnlocked;
  }

  private getUnlockedBy(categoryId: string): ResearchCategory[] {
    return RESEARCH_CATEGORIES.filter((cat) =>
      cat.prerequisites.includes(categoryId)
    );
  }

  private unlockCategory(lineageId: string, categoryId: string): boolean {
    const unlocked = this.unlockedCategories.get(lineageId);
    if (!unlocked) return false;

    const category = this.getCategory(categoryId);
    if (!category) return false;

    const available = category.prerequisites.every((prereq) =>
      unlocked.has(prereq)
    );

    if (available && !unlocked.has(categoryId)) {
      unlocked.add(categoryId);
      return true;
    }

    return false;
  }

  private getCategory(categoryId: string): ResearchCategory | undefined {
    return RESEARCH_CATEGORIES.find((cat) => cat.id === categoryId);
  }

  private evaluateSpecialization(lineageId: string): void {
    const researchMap = this.lineageResearch.get(lineageId);
    if (!researchMap) return;

    const specializations: Array<{ categoryId: string; progress: number }> = [];

    researchMap.forEach((node, categoryId) => {
      if (node.progress >= 0.5) {
        specializations.push({ categoryId, progress: node.progress });
      }
    });

    specializations.sort((a, b) => b.progress - a.progress);
    const topSpecializations = specializations
      .slice(0, 3)
      .map((s) => s.categoryId);

    this.lineageSpecializations.set(lineageId, topSpecializations);
  }

  public getSpecializations(lineageId: string): string[] {
    return this.lineageSpecializations.get(lineageId) || [];
  }

  public getResearchProgress(
    lineageId: string
  ): Map<string, ResearchNode> | undefined {
    return this.lineageResearch.get(lineageId);
  }

  public getAvailableCategories(lineageId: string): ResearchCategory[] {
    const unlocked = this.unlockedCategories.get(lineageId);
    if (!unlocked) return [];

    return RESEARCH_CATEGORIES.filter((cat) =>
      cat.prerequisites.every((prereq) => unlocked.has(prereq))
    );
  }

  public isCategoryUnlocked(lineageId: string, categoryId: string): boolean {
    const unlocked = this.unlockedCategories.get(lineageId);
    return unlocked?.has(categoryId) || false;
  }

  public getProficiencyBonus(lineageId: string, categoryId: string): number {
    const specializations = this.getSpecializations(lineageId);

    if (specializations.includes(categoryId)) {
      return 0.2;
    }

    const researchMap = this.lineageResearch.get(lineageId);
    if (!researchMap) return 0;

    const node = researchMap.get(categoryId);
    if (!node) return 0;

    return node.progress >= 1.0 ? 0.1 : 0;
  }

  public getLineageStats(lineageId: string): LineageResearchStats {
    const unlocked = this.unlockedCategories.get(lineageId);
    const researchMap = this.lineageResearch.get(lineageId);
    const specializations = this.getSpecializations(lineageId);

    const totalCategories = RESEARCH_CATEGORIES.length;
    const unlockedCount = unlocked?.size || 0;

    let completedCount = 0;
    let totalProgress = 0;

    if (researchMap) {
      researchMap.forEach((node) => {
        if (node.progress >= 1.0) completedCount++;
        totalProgress += node.progress;
      });
    }

    return {
      totalCategories,
      unlockedCategories: unlockedCount,
      completedCategories: completedCount,
      totalProgress: researchMap && researchMap.size > 0
        ? totalProgress / researchMap.size
        : 0,
      specializations,
    };
  }

  public getAvailableRecipes(lineageId: string): string[] {
    const unlocked = this.unlockedCategories.get(lineageId);
    if (!unlocked) return [];

    const recipes: string[] = [];

    unlocked.forEach((categoryId) => {
      const category = this.getCategory(categoryId);
      if (category) {
        recipes.push(...category.recipes);
      }
    });

    return recipes;
  }

  public suggestNextResearch(lineageId: string, limit = 3): ResearchCategory[] {
    const unlocked = this.unlockedCategories.get(lineageId);
    if (!unlocked) return [];

    const available = RESEARCH_CATEGORIES.filter(
      (cat) =>
        !unlocked.has(cat.id) &&
        cat.prerequisites.every((prereq) => unlocked.has(prereq))
    );

    return available.slice(0, limit);
  }

  public getTechTreeState(lineageId: string): TechTreeState {
    const unlocked = this.unlockedCategories.get(lineageId);
    const researchMap = this.lineageResearch.get(lineageId);

    const nodes = RESEARCH_CATEGORIES.map((category) => {
      const node = researchMap?.get(category.id);
      return {
        category,
        unlocked: unlocked?.has(category.id) || false,
        completed: (node?.progress || 0) >= 1.0,
        progress: node?.progress || 0,
      };
    });

    const connections: Array<{ from: string; to: string }> = [];
    RESEARCH_CATEGORIES.forEach((category) => {
      category.prerequisites.forEach((prereqId) => {
        connections.push({
          from: prereqId,
          to: category.id,
        });
      });
    });

    return { nodes, connections };
  }

  public getAllLineagesStats(): Array<{
    lineageId: string;
    stats: LineageResearchStats;
  }> {
    const lineages: Array<{
      lineageId: string;
      stats: LineageResearchStats;
    }> = [];

    this.lineageResearch.forEach((_, lineageId) => {
      lineages.push({
        lineageId,
        stats: this.getLineageStats(lineageId),
      });
    });

    return lineages;
  }

  public update(): void {
    // Escribir estado en GameState para sincronización con frontend
    if (!this.gameState.research) {
      this.gameState.research = {
        techTree: { nodes: [], connections: [] },
        lineages: [],
      };
    }

    // Obtener el primer lineage disponible o crear uno por defecto
    const lineageIds = Array.from(this.lineageResearch.keys());
    if (lineageIds.length === 0) {
      // Si no hay lineages, usar un ID por defecto
      const defaultLineageId = "default";
      if (!this.lineageResearch.has(defaultLineageId)) {
        this.initializeLineage(defaultLineageId);
      }
      lineageIds.push(defaultLineageId);
    }

    // Actualizar tech tree del primer lineage (o se puede extender para múltiples)
    const primaryLineageId = lineageIds[0];
    this.gameState.research.techTree = this.getTechTreeState(primaryLineageId);

    // Actualizar stats de todos los lineages - el frontend espera una estructura específica
    const allLineagesStats = this.getAllLineagesStats();
    this.gameState.research.lineages = allLineagesStats.map(({ lineageId, stats }) => ({
      lineageId,
      stats,
      // Agregar datos adicionales que el frontend puede necesitar
      nodes: Array.from(this.getResearchProgress(lineageId)?.values() || []).map(node => ({
        categoryId: node.categoryId,
        progress: node.progress,
        recipesDiscovered: node.recipesDiscovered,
        contributors: node.contributors,
      })),
      unlockedCategories: Array.from(
        this.lineageResearch.get(lineageId)?.keys() || []
      ),
      specializations: this.getSpecializations(lineageId),
    }));
  }

  public cleanup(): void {
    this.lineageResearch.clear();
    this.unlockedCategories.clear();
    this.lineageSpecializations.clear();
  }
}
