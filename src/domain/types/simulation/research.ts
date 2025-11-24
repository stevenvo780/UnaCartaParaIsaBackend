export interface ResearchNode {
  categoryId: string;
  unlockedAt: number;
  progress: number;
  recipesDiscovered: string[];
  contributors: string[];
}

export interface ResearchCategory {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  recipes: string[];
  tier: number;
}

export interface LineageResearchStats {
  totalCategories: number;
  unlockedCategories: number;
  completedCategories: number;
  totalProgress: number;
  specializations: string[];
}

export interface TechTreeState {
  nodes: Array<{
    category: ResearchCategory;
    unlocked: boolean;
    completed: boolean;
    progress: number;
  }>;
  connections: Array<{ from: string; to: string }>;
}
