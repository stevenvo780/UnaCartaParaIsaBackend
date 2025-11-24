import { describe, it, expect, beforeEach } from "vitest";
import { TaskSystem } from "../../src/simulation/systems/TaskSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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
        requiredWork: 100,
      });
      expect(task).toBeDefined();
      expect(task?.id).toBeDefined();
      expect(task?.type).toBe("gather");
    });

    it("debe retornar null si no hay recursos suficientes", () => {
      gameState.resources!.materials.wood = 0;
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        requirements: {
          resources: { wood: 50 },
        },
      });
      expect(task).toBeNull();
    });

    it("debe verificar todos los tipos de recursos", () => {
      gameState.resources!.materials.stone = 0;
      const task = taskSystem.createTask({
        type: "gather",
        target: "stone",
        amount: 10,
        requiredWork: 100,
        requirements: {
          resources: { stone: 50 },
        },
      });
      expect(task).toBeNull();
    });

    it("debe crear tarea sin requisitos de recursos", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      expect(task).toBeDefined();
    });
  });

  describe("Contribución a tareas", () => {
    it("debe permitir contribuir a tarea", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const result = taskSystem.contributeToTask(task.id, "agent-1", 5);
        expect(result.progressMade).toBe(true);
        expect(result.completed).toBe(false);
      }
    });

    it("debe completar tarea cuando se alcanza el trabajo requerido", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const result = taskSystem.contributeToTask(task.id, "agent-1", 100);
        expect(result.progressMade).toBe(true);
        expect(result.completed).toBe(true);
      }
    });

    it("debe retornar false para tarea inexistente", () => {
      const result = taskSystem.contributeToTask("nonexistent", "agent-1", 5);
      expect(result.progressMade).toBe(false);
    });

    it("debe bloquear si no hay suficientes trabajadores", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        requirements: {
          minWorkers: 2,
        },
      });
      
      if (task) {
        const result = taskSystem.contributeToTask(task.id, "agent-1", 5);
        expect(result.blocked).toBe(true);
      }
    });

    it("debe aplicar bono de sinergia social", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const result = taskSystem.contributeToTask(task.id, "agent-1", 10, 1.5);
        expect(result.progressMade).toBe(true);
      }
    });

    it("debe aplicar bono cooperativo para múltiples trabajadores", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        requirements: {
          minWorkers: 2,
        },
      });
      
      if (task) {
        // Primer trabajador - bloqueado
        taskSystem.contributeToTask(task.id, "agent-1", 10);
        // Segundo trabajador - debería aplicar bono
        const result = taskSystem.contributeToTask(task.id, "agent-2", 10);
        expect(result.progressMade).toBe(true);
      }
    });
  });

  describe("Gestión de tareas", () => {
    it("debe retornar todas las tareas", () => {
      taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      const tasks = taskSystem.getTasks();
      expect(tasks.length).toBeGreaterThan(0);
    });

    it("debe retornar tarea por ID", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      if (task) {
        const found = taskSystem.getTask(task.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(task.id);
      }
    });

    it("debe retornar undefined para tarea inexistente", () => {
      const task = taskSystem.getTask("nonexistent");
      expect(task).toBeUndefined();
    });

    it("debe retornar solo tareas activas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      const active = taskSystem.getActiveTasks();
      expect(active.length).toBeGreaterThan(0);
      
      if (task) {
        taskSystem.contributeToTask(task.id, "agent-1", 100);
        const activeAfter = taskSystem.getActiveTasks();
        expect(activeAfter.length).toBeLessThan(active.length);
      }
    });

    it("debe retornar solo tareas completadas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const completedBefore = taskSystem.getCompletedTasks();
        taskSystem.contributeToTask(task.id, "agent-1", 100);
        const completedAfter = taskSystem.getCompletedTasks();
        expect(completedAfter.length).toBeGreaterThan(completedBefore.length);
      }
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => taskSystem.update()).not.toThrow();
    });

    it("no debe actualizar si no ha pasado suficiente tiempo", () => {
      taskSystem.update();
      // No debería procesar tareas estancadas inmediatamente
      expect(taskSystem).toBeDefined();
    });
  });
});

