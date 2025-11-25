import { describe, it, expect, beforeEach } from "vitest";
import { ResearchSystem } from "../../src/domain/simulation/systems/ResearchSystem";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/domain/types/game-types";

const lineageId = "lineage-1";

describe("ResearchSystem", () => {
  let gameState: GameState;
  let system: ResearchSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    system = new ResearchSystem(gameState);
    system.initializeLineage(lineageId);
  });

  it("inicializa linaje con basic_survival desbloqueado", () => {
    expect(system.isCategoryUnlocked(lineageId, "basic_survival")).toBe(true);
    expect(system.getAvailableRecipes(lineageId)).toContain("cook_meat");
  });

  it("onRecipeDiscovered incrementa progreso y desbloquea categorías siguientes", () => {
    const categoryRecipes = ["cook_meat", "cook_fish", "make_rope", "wooden_club"];
    let unlocked: string[] = [];

    categoryRecipes.forEach((recipe) => {
      const result = system.onRecipeDiscovered(lineageId, recipe, "agent-1");
      unlocked = result.unlocked;
    });

    expect(unlocked).toContain("woodworking");
    expect(system.isCategoryUnlocked(lineageId, "woodworking")).toBe(true);
  });

  it("getProficiencyBonus refleja especializaciones", () => {
    system.onRecipeDiscovered(lineageId, "cook_meat", "agent-1");
    system.onRecipeDiscovered(lineageId, "cook_fish", "agent-1");
    system.onRecipeDiscovered(lineageId, "make_rope", "agent-1");

    expect(system.getProficiencyBonus(lineageId, "basic_survival")).toBe(0.2);
  });

  it("getLineageStats retorna progreso y especializaciones", () => {
    system.onRecipeDiscovered(lineageId, "cook_meat", "agent-1");
    system.onRecipeDiscovered(lineageId, "cook_fish", "agent-1");
    system.onRecipeDiscovered(lineageId, "make_rope", "agent-1");

    const stats = system.getLineageStats(lineageId);
    expect(stats.unlockedCategories).toBeGreaterThan(0);
    expect(stats.specializations.length).toBeGreaterThanOrEqual(1);
  });

  it("getAvailableCategories respeta prerequisitos", () => {
    const available = system.getAvailableCategories(lineageId);
    expect(available.find((cat) => cat.id === "woodworking")).toBeDefined();
  });

  it("update genera estado del tech tree y estadísticas en gameState", () => {
    system.onRecipeDiscovered(lineageId, "cook_meat", "agent-1");
    system.update();

    expect(gameState.research?.techTree.nodes.length).toBeGreaterThan(0);
    expect(gameState.research?.lineages.length).toBeGreaterThan(0);
  });

  it("cleanup limpia toda la información almacenada", () => {
    system.cleanup();
    expect(system.getResearchProgress(lineageId)).toBeUndefined();
  });
});
