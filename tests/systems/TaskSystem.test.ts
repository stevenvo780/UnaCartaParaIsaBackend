import { describe, it, expect, beforeEach } from "vitest";
import { TaskSystem } from "../../src/simulation/systems/TaskSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("TaskSystem", () => {
  let gameState: GameState;
  let taskSystem: TaskSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      resources: {
        materials: {
          wood: 50,
          stone: 30,
          food: 40,
          water: 20,
        },
        energy: 0,
        currency: 0,
        experience: 0,
        unlockedFeatures: [],
      },
    });
    taskSystem = new TaskSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(taskSystem).toBeDefined();
    });
  });

  describe("Creación de tareas", () => {
    it("debe crear tarea", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
      });
      expect(task).toBeDefined();
      expect(task?.id).toBeDefined();
    });

    it("debe retornar null si no hay recursos suficientes", () => {
      gameState.resources!.materials.wood = 0;
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requirements: {
          resources: { wood: 50 },
        },
      });
      expect(task).toBeNull();
    });
  });

  describe("Contribución a tareas", () => {
    it("debe permitir contribuir a tarea", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
      });
      
      if (task) {
        const result = taskSystem.contributeToTask(task.id, "agent-1", 5);
        expect(result.progressMade).toBe(true);
      }
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => taskSystem.update()).not.toThrow();
    });
  });
});

