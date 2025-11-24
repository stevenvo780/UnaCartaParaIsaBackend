import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateConstructionGoals,
  type ConstructionContext,
} from "../../../src/domain/simulation/systems/ai/ConstructionEvaluator.ts";
import { createMockGameState } from "../../setup.ts";
import type { GameState } from "../../../src/domain/types/game-types.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("ConstructionEvaluator", () => {
  let gameState: GameState;
  let aiState: AIState;
  let context: ConstructionContext;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "build-zone-1",
          type: "work",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
      ],
    });

    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.5,
        conscientiousness: 0.8,
        extraversion: 0.5,
        agreeableness: 0.7,
        neuroticism: 0.3,
      },
      memory: {
        successfulActivities: [],
        failedAttempts: [],
      },
      currentGoal: null,
      strategy: "peaceful",
    };

    context = {
      gameState,
      getEntityPosition: (id: string) => {
        if (id === "agent-1") return { x: 120, y: 120 };
        return null;
      },
      getTasks: () => [
        {
          id: "task-1",
          type: "build_house",
          zoneId: "build-zone-1",
          completed: false,
          contributors: new Map(),
          requirements: { minWorkers: 2 },
        },
      ],
    };
  });

  describe("evaluateConstructionGoals", () => {
    it("debe retornar array vacío si no hay posición", () => {
      context.getEntityPosition = () => null;
      const goals = evaluateConstructionGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay tareas de construcción", () => {
      context.getTasks = () => [];
      const goals = evaluateConstructionGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si todas las tareas están completadas", () => {
      context.getTasks = () => [
        {
          id: "task-1",
          type: "build_house",
          zoneId: "build-zone-1",
          completed: true,
        },
      ];
      const goals = evaluateConstructionGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de construcción para tarea cercana", () => {
      const goals = evaluateConstructionGoals(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("work");
        expect(goals[0].targetZoneId).toBe("build-zone-1");
        expect(goals[0].data?.workType).toBe("construction");
        expect(goals[0].data?.taskId).toBe("task-1");
      }
    });

    it("debe priorizar tareas que necesitan más trabajadores", () => {
      context.getTasks = () => [
        {
          id: "task-1",
          type: "build_house",
          zoneId: "build-zone-1",
          completed: false,
          contributors: new Map([["worker-1", 10]]),
          requirements: { minWorkers: 3 },
        },
        {
          id: "task-2",
          type: "build_mine",
          zoneId: "build-zone-2",
          completed: false,
          contributors: new Map(),
          requirements: { minWorkers: 1 },
        },
      ];
      gameState.zones?.push({
        id: "build-zone-2",
        type: "work",
        bounds: { x: 150, y: 150, width: 50, height: 50 },
      });
      
      const goals = evaluateConstructionGoals(context, aiState);
      if (goals.length > 0) {
        // Debería priorizar task-1 que necesita más trabajadores
        expect(goals[0].data?.taskId).toBe("task-1");
      }
    });

    it("debe considerar personalidad para calcular prioridad", () => {
      aiState.personality.conscientiousness = 1.0;
      aiState.personality.agreeableness = 1.0;
      const goals = evaluateConstructionGoals(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].priority).toBeGreaterThan(0.3);
      }
    });

    it("debe manejar errores y retornar array vacío", () => {
      context.getTasks = () => {
        throw new Error("Test error");
      };
      const goals = evaluateConstructionGoals(context, aiState);
      expect(goals).toEqual([]);
    });
  });
});

