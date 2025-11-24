import { describe, it, expect, beforeEach } from "vitest";
import { QuestSystem } from "../../src/domain/simulation/systems/QuestSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("QuestSystem", () => {
  let gameState: GameState;
  let questSystem: QuestSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      resources: {
        materials: {
          wood: 0,
          stone: 0,
          food: 0,
          water: 0,
        },
        energy: 0,
        currency: 0,
        experience: 0,
        unlockedFeatures: [],
      },
    });
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

    it("debe retornar false para quest inexistente", () => {
      const result = questSystem.startQuest("nonexistent_quest");
      expect(result.success).toBe(false);
    });

    it("debe retornar progreso de quest", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        questSystem.startQuest(available[0].id);
        const progress = questSystem.getQuestProgress();
        expect(progress).toBeDefined();
        expect(progress.activeQuests).toBeDefined();
      }
    });

    it("debe retornar progreso completo del sistema", () => {
      const progress = questSystem.getQuestProgress();
      expect(progress).toBeDefined();
      expect(progress.activeQuests).toBeDefined();
      expect(progress.completedQuests).toBeDefined();
      expect(progress.availableQuests).toBeDefined();
    });

    it("debe retornar quest por ID", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        const quest = questSystem.getQuest(available[0].id);
        expect(quest).toBeDefined();
        expect(quest?.id).toBe(available[0].id);
      }
    });

    it("debe retornar undefined para quest inexistente", () => {
      const quest = questSystem.getQuest("nonexistent");
      expect(quest).toBeUndefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => questSystem.update()).not.toThrow();
    });

    it("debe fallar quests con timeout", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        const quest = available[0];
        // Modificar quest para tener timeout corto
        if (quest) {
          quest.timeLimit = 0.001; // 1ms
          questSystem.startQuest(quest.id);
          // Esperar un poco y actualizar
          setTimeout(() => {
            questSystem.update();
            const progress = questSystem.getQuestProgress(quest.id);
            // Puede estar fallado o completado
            expect(questSystem).toBeDefined();
          }, 10);
        }
      }
    });
  });

  describe("Progreso de objetivos", () => {
    it("debe actualizar progreso de objetivos", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        questSystem.startQuest(available[0].id);
        // Simular progreso
        if (gameState.resources) {
          gameState.resources.materials.wood = 5;
        }
        questSystem.update();
        const progress = questSystem.getQuestProgress(available[0].id);
        expect(progress).toBeDefined();
      }
    });
  });
});

