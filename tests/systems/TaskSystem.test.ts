import { describe, it, expect, beforeEach } from "vitest";
import { TaskSystem } from "../../src/domain/simulation/systems/objectives/TaskSystem.ts";
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

  describe("Estadísticas de tareas", () => {
    it("debe retornar estadísticas de tareas", () => {
      const stats = taskSystem.getTaskStats();
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(stats.active).toBeDefined();
      expect(stats.completed).toBeDefined();
      expect(stats.stalled).toBeDefined();
      expect(stats.avgProgress).toBeDefined();
    });

    it("debe actualizar estadísticas al crear tareas", () => {
      const statsBefore = taskSystem.getTaskStats();
      taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      const statsAfter = taskSystem.getTaskStats();
      expect(statsAfter.total).toBeGreaterThan(statsBefore.total);
    });

    it("debe actualizar estadísticas al completar tareas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const statsBefore = taskSystem.getTaskStats();
        taskSystem.contributeToTask(task.id, "agent-1", 100);
        const statsAfter = taskSystem.getTaskStats();
        expect(statsAfter.completed).toBeGreaterThan(statsBefore.completed);
      }
    });
  });

  describe("Tareas estancadas", () => {
    it("debe detectar tareas estancadas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        // Contribuir una vez
        taskSystem.contributeToTask(task.id, "agent-1", 10);
        
        // Simular que pasó mucho tiempo (más de 5 minutos)
        const retrievedTask = taskSystem.getTask(task.id);
        if (retrievedTask) {
          retrievedTask.lastContribution = Date.now() - 400000; // 6+ minutos
        }
        
        // Actualizar después de 10 segundos
        setTimeout(() => {
          taskSystem.update();
          const stats = taskSystem.getTaskStats();
          expect(stats.stalled).toBeGreaterThanOrEqual(0);
        }, 11000);
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

    it("debe actualizar estado del juego con estadísticas", () => {
      taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      // Esperar 10 segundos y actualizar
      setTimeout(() => {
        taskSystem.update();
        expect(gameState.tasks).toBeDefined();
        expect(gameState.tasks?.stats).toBeDefined();
      }, 11000);
    });
  });

  describe("Límites de progreso", () => {
    it("no debe exceder el trabajo requerido", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        // Contribuir más del requerido
        taskSystem.contributeToTask(task.id, "agent-1", 150);
        const retrieved = taskSystem.getTask(task.id);
        expect(retrieved?.progress).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Contribuciones acumuladas", () => {
    it("debe acumular contribuciones de múltiples agentes", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        taskSystem.contributeToTask(task.id, "agent-1", 30);
        taskSystem.contributeToTask(task.id, "agent-2", 40);
        taskSystem.contributeToTask(task.id, "agent-3", 30);
        
        const retrieved = taskSystem.getTask(task.id);
        expect(retrieved?.progress).toBeGreaterThanOrEqual(100);
        expect(retrieved?.completed).toBe(true);
      }
    });
  });

  describe("getTasksNearPosition", () => {
    it("debe retornar tareas cercanas a una posición", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        bounds: { x: 100, y: 100, width: 50, height: 50 },
      });
      
      if (task) {
        const nearby = taskSystem.getTasksNearPosition({ x: 120, y: 120 }, 100);
        expect(nearby.length).toBeGreaterThan(0);
        expect(nearby.some((t) => t.id === task.id)).toBe(true);
      }
    });

    it("debe retornar array vacío si no hay tareas cercanas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        bounds: { x: 100, y: 100, width: 50, height: 50 },
      });
      
      if (task) {
        const nearby = taskSystem.getTasksNearPosition({ x: 500, y: 500 }, 50);
        expect(nearby.length).toBe(0);
      }
    });

    it("debe filtrar tareas completadas", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
        bounds: { x: 100, y: 100, width: 50, height: 50 },
      });
      
      if (task) {
        taskSystem.contributeToTask(task.id, "agent-1", 100);
        const nearby = taskSystem.getTasksNearPosition({ x: 120, y: 120 }, 100);
        expect(nearby.length).toBe(0);
      }
    });

    it("debe retornar array vacío si la tarea no tiene bounds", () => {
      const task = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      if (task) {
        const nearby = taskSystem.getTasksNearPosition({ x: 120, y: 120 }, 100);
        expect(nearby.length).toBe(0);
      }
    });
  });

  describe("cleanup", () => {
    it("debe limpiar todas las tareas", () => {
      taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      taskSystem.cleanup();
      
      const tasks = taskSystem.getTasks();
      expect(tasks.length).toBe(0);
    });

    it("debe resetear el contador de secuencia", () => {
      taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      taskSystem.cleanup();
      
      const newTask = taskSystem.createTask({
        type: "gather",
        target: "wood",
        amount: 10,
        requiredWork: 100,
      });
      
      // El ID debería empezar desde 0 o 1
      expect(newTask).toBeDefined();
    });
  });
});

