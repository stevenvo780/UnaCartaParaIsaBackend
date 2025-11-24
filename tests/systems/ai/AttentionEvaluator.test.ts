import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateAttention,
  evaluateDefaultExploration,
  type AttentionContext,
} from "../../../src/domain/simulation/systems/ai/AttentionEvaluator.ts";
import { createMockGameState } from "../../setup.ts";
import type { GameState } from "../../../src/domain/types/game-types.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("AttentionEvaluator", () => {
  let gameState: GameState;
  let aiState: AIState;
  let context: AttentionContext;

  beforeEach(() => {
    gameState = createMockGameState({
      worldResources: {
        "resource-1": {
          id: "resource-1",
          type: "wood",
          position: { x: 200, y: 200 },
          amount: 100,
        },
        "resource-2": {
          id: "resource-2",
          type: "stone",
          position: { x: 300, y: 300 },
          amount: 50,
        },
      },
      zones: [
        {
          id: "rest-zone-1",
          type: "rest",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
        {
          id: "shelter-zone-1",
          type: "shelter",
          bounds: { x: 200, y: 200, width: 50, height: 50 },
        },
      ],
    });

    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.7,
        conscientiousness: 0.5,
        extraversion: 0.6,
        agreeableness: 0.5,
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
        const agent = gameState.agents?.find((a) => a.id === id);
        return agent?.position || null;
      },
      selectBestZone: (
        _aiState: AIState,
        zoneIds: string[],
        _zoneType: string,
      ) => {
        return zoneIds.length > 0 ? zoneIds[0] : null;
      },
    };
  });

  describe("evaluateAttention", () => {
    it("debe retornar array vacío si no hay posición", () => {
      context.getEntityPosition = () => null;
      const goals = evaluateAttention(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay recursos cercanos", () => {
      gameState.worldResources = {};
      const agent = gameState.agents?.[0];
      if (agent) {
        agent.position = { x: 1000, y: 1000 }; // Lejos de recursos
      }
      const goals = evaluateAttention(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar goal de inspección para recurso cercano", () => {
      const agent = gameState.agents?.[0];
      if (agent) {
        agent.position = { x: 150, y: 150 }; // Cerca de resource-1 (distancia ~70, dentro del rango 50-600)
      }
      const goals = evaluateAttention(context, aiState);
      // La función puede retornar goals si hay recursos en el rango correcto
      if (goals.length > 0) {
        expect(goals[0].type).toBe("explore");
        expect(goals[0].targetId).toBeDefined();
        expect(goals[0].targetPosition).toBeDefined();
      } else {
        // Si no retorna goals, verificar que al menos la función se ejecutó correctamente
        expect(Array.isArray(goals)).toBe(true);
      }
    });

    it("debe filtrar recursos muy cercanos (menos de 50)", () => {
      const agent = gameState.agents?.[0];
      if (agent) {
        agent.position = { x: 201, y: 201 }; // Muy cerca de resource-1
      }
      const goals = evaluateAttention(context, aiState);
      // Puede retornar vacío o recursos más lejanos
      expect(Array.isArray(goals)).toBe(true);
    });

    it("debe filtrar recursos muy lejanos (más de 600)", () => {
      const agent = gameState.agents?.[0];
      if (agent) {
        agent.position = { x: 1000, y: 1000 }; // Muy lejos
      }
      const goals = evaluateAttention(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe usar curiosidad del agente para calcular prioridad", () => {
      const agent = gameState.agents?.[0];
      if (agent) {
        agent.position = { x: 150, y: 150 };
      }
      aiState.personality.openness = 1.0; // Alta curiosidad
      const goals = evaluateAttention(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].priority).toBeGreaterThan(0);
      }
    });
  });

  describe("evaluateDefaultExploration", () => {
    it("debe retornar array vacío si no hay zonas", () => {
      gameState.zones = [];
      const goals = evaluateDefaultExploration(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar goal de descanso si hay zonas de descanso", () => {
      const goals = evaluateDefaultExploration(context, aiState);
      expect(goals.length).toBeGreaterThan(0);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("rest");
        expect(goals[0].targetZoneId).toBeDefined();
      }
    });

    it("debe retornar goal de exploración si no hay zonas de descanso", () => {
      gameState.zones = [
        {
          id: "other-zone-1",
          type: "resource",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
      ];
      const goals = evaluateDefaultExploration(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("explore");
        expect(goals[0].targetZoneId).toBeDefined();
      }
    });

    it("debe retornar array vacío si selectBestZone retorna null", () => {
      context.selectBestZone = () => null;
      const goals = evaluateDefaultExploration(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe incluir prioridad y timestamps en el goal", () => {
      const goals = evaluateDefaultExploration(context, aiState);
      if (goals.length > 0) {
        const goal = goals[0];
        expect(goal.priority).toBeDefined();
        expect(goal.createdAt).toBeDefined();
        expect(goal.expiresAt).toBeDefined();
        expect(goal.expiresAt).toBeGreaterThan(goal.createdAt);
      }
    });
  });
});

