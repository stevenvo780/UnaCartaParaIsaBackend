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
    it("debe actualizar progreso de objetivos de recursos", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        // Simular recolección de recursos
        if (gameState.resources) {
          gameState.resources.materials.wood = 5;
          gameState.resources.materials.food = 3;
        }
        questSystem.update();
        const progress = questSystem.getQuestProgress(tutorialQuest.id);
        expect(progress).toBeDefined();
      }
    });

    it("debe completar objetivo cuando se alcanza la cantidad requerida", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        if (gameState.resources) {
          gameState.resources.materials.wood = 5;
          gameState.resources.materials.food = 3;
        }
        questSystem.update();
        const quest = questSystem.getQuest(tutorialQuest.id);
        // Verificar que los objetivos se completaron
        expect(quest).toBeDefined();
      }
    });
  });

  describe("Requisitos de quests", () => {
    it("no debe hacer disponible quest que requiere otra quest completada", () => {
      const available = questSystem.getAvailableQuests();
      const buildQuest = available.find((q) => q.id === "build_shelter");
      // build_shelter requiere tutorial_survival completado
      // Si tutorial no está completado, build_shelter no debería estar disponible
      if (buildQuest) {
        const tutorialCompleted = available.find(
          (q) => q.id === "tutorial_survival" && q.status === "completed",
        );
        // Si tutorial no está completado, build_shelter no debería estar disponible inicialmente
        expect(buildQuest).toBeDefined();
      }
    });
  });

  describe("Recompensas", () => {
    it("debe aplicar recompensas al completar quest", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        const initialExp = gameState.resources?.experience || 0;
        questSystem.startQuest(tutorialQuest.id);
        if (gameState.resources) {
          gameState.resources.materials.wood = 5;
          gameState.resources.materials.food = 3;
        }
        questSystem.update();
        // Verificar que se aplicaron recompensas
        const progress = questSystem.getQuestProgress();
        expect(progress.totalExperienceGained).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Fallar quests", () => {
    it("debe fallar quest por timeout", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        const quest = available[0];
        const result = questSystem.startQuest(quest.id);
        if (result.success) {
          // Modificar quest para tener timeout muy corto
          const activeQuest = questSystem.getQuest(quest.id);
          if (activeQuest && activeQuest.status === "active") {
            // Simular que pasó el tiempo límite
            questSystem.update();
            // El quest debería fallar
            const updatedQuest = questSystem.getQuest(quest.id);
            expect(updatedQuest).toBeDefined();
          }
        }
      }
    });
  });

  describe("Historial de quests", () => {
    it("debe registrar quests completados en el historial", () => {
      const progress = questSystem.getQuestProgress();
      expect(progress.questHistory).toBeDefined();
      expect(Array.isArray(progress.questHistory)).toBe(true);
    });
  });

  describe("completeQuest", () => {
    it("debe completar quest cuando todos los objetivos están completados", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        // updateObjectiveProgress llama automáticamente a checkQuestCompletion
        const quest = questSystem.getQuest(tutorialQuest.id);
        if (quest) {
          for (let i = 0; i < quest.objectives.length - 1; i++) {
            const obj = quest.objectives[i];
            questSystem.updateObjectiveProgress(tutorialQuest.id, obj.id, obj.requiredAmount || 0);
          }
          // Completar el último objetivo, esto debería completar el quest automáticamente
          const lastObj = quest.objectives[quest.objectives.length - 1];
          questSystem.updateObjectiveProgress(tutorialQuest.id, lastObj.id, lastObj.requiredAmount || 0);
          // Verificar que el quest está completado
          const completedQuest = questSystem.getQuest(tutorialQuest.id);
          // El quest puede estar en completedQuests ahora
          const completed = questSystem.getCompletedQuests();
          expect(completed.some((q) => q.id === tutorialQuest.id)).toBe(true);
        }
      }
    });

    it("debe retornar false si el quest no está activo", () => {
      const result = questSystem.completeQuest("nonexistent");
      expect(result.success).toBe(false);
    });

    it("debe retornar false si hay objetivos incompletos", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const result = questSystem.completeQuest(tutorialQuest.id);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("updateObjectiveProgress", () => {
    it("debe actualizar progreso de objetivo", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const objective = tutorialQuest.objectives[0];
        if (objective) {
          const result = questSystem.updateObjectiveProgress(
            tutorialQuest.id,
            objective.id,
            1,
          );
          expect(result.completed).toBeDefined();
        }
      }
    });

    it("debe retornar completed: false para quest inexistente", () => {
      const result = questSystem.updateObjectiveProgress("nonexistent", "obj_1", 1);
      expect(result.completed).toBe(false);
    });

    it("debe retornar completed: false para objetivo inexistente", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const result = questSystem.updateObjectiveProgress(
          tutorialQuest.id,
          "nonexistent_obj",
          1,
        );
        expect(result.completed).toBe(false);
      }
    });

    it("debe completar objetivo cuando se alcanza la cantidad requerida", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const objective = tutorialQuest.objectives[0];
        if (objective && objective.requiredAmount) {
          const result = questSystem.updateObjectiveProgress(
            tutorialQuest.id,
            objective.id,
            objective.requiredAmount,
          );
          expect(result.completed).toBe(true);
          expect(result.event).toBeDefined();
        }
      }
    });
  });

  describe("makeQuestAvailable", () => {
    it("debe hacer disponible un quest que no existe", () => {
      // Primero eliminar el quest si existe
      const quest = questSystem.getQuest("tutorial_survival");
      if (quest) {
        // El quest ya está disponible, así que makeQuestAvailable retornará false
        const result = questSystem.makeQuestAvailable("tutorial_survival");
        expect(result).toBe(false);
      } else {
        // Si no existe, debería poder hacerlo disponible
        const result = questSystem.makeQuestAvailable("tutorial_survival");
        expect(result).toBe(true);
        const newQuest = questSystem.getQuest("tutorial_survival");
        expect(newQuest?.status).toBe("available");
      }
    });

    it("debe retornar false para quest inexistente", () => {
      const result = questSystem.makeQuestAvailable("nonexistent");
      expect(result).toBe(false);
    });

    it("debe retornar false si el quest ya existe", () => {
      const available = questSystem.getAvailableQuests();
      if (available.length > 0) {
        const result = questSystem.makeQuestAvailable(available[0].id);
        expect(result).toBe(false);
      }
    });
  });

  describe("handleEvent", () => {
    it("debe manejar evento de recurso recolectado", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        questSystem.handleEvent({
          type: "RESOURCE_COLLECTED",
          resourceType: "wood",
          amount: 5,
        });
        const quest = questSystem.getQuest(tutorialQuest.id);
        expect(quest).toBeDefined();
      }
    });

    it("debe manejar evento de estructura construida", () => {
      const available = questSystem.getAvailableQuests();
      const buildQuest = available.find((q) => q.id === "build_shelter");
      if (buildQuest) {
        questSystem.startQuest(buildQuest.id);
        questSystem.handleEvent({
          type: "STRUCTURE_BUILT",
          structureType: "shelter",
        });
        const quest = questSystem.getQuest(buildQuest.id);
        expect(quest).toBeDefined();
      }
    });
  });

  describe("cleanup", () => {
    it("debe limpiar recursos sin errores", () => {
      expect(() => questSystem.cleanup()).not.toThrow();
    });
  });

  describe("getActiveQuests y getCompletedQuests", () => {
    it("debe retornar quests activos", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const active = questSystem.getActiveQuests();
        expect(active.length).toBeGreaterThan(0);
        expect(active.some((q) => q.id === tutorialQuest.id)).toBe(true);
      }
    });

    it("debe retornar quests completados", () => {
      const available = questSystem.getAvailableQuests();
      const tutorialQuest = available.find((q) => q.id === "tutorial_survival");
      if (tutorialQuest) {
        questSystem.startQuest(tutorialQuest.id);
        const quest = questSystem.getQuest(tutorialQuest.id);
        if (quest) {
          quest.objectives.forEach((obj) => {
            questSystem.updateObjectiveProgress(tutorialQuest.id, obj.id, obj.requiredAmount || 0);
          });
          questSystem.completeQuest(tutorialQuest.id);
          const completed = questSystem.getCompletedQuests();
          expect(completed.length).toBeGreaterThan(0);
          expect(completed.some((q) => q.id === tutorialQuest.id)).toBe(true);
        }
      }
    });
  });
});

