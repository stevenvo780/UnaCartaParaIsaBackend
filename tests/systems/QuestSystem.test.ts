import { describe, it, expect, beforeEach } from "vitest";
import { QuestSystem } from "../../src/simulation/systems/QuestSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("QuestSystem", () => {
  let gameState: GameState;
  let questSystem: QuestSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    questSystem = new QuestSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(questSystem).toBeDefined();
    });
  });

  describe("Gestión de quests", () => {
    it("debe retornar quests disponibles", () => {
      const available = questSystem.getAvailableQuests();
      expect(Array.isArray(available)).toBe(true);
    });

    it("debe iniciar quest", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        const result = questSystem.startQuest(available[0].id);
        expect(result.success).toBe(true);
      }
    });

    it("debe retornar progreso de quest", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        questSystem.startQuest(available[0].id);
        const progress = questSystem.getQuestProgress(available[0].id);
        expect(progress).toBeDefined();
      }
    });
  });
});

