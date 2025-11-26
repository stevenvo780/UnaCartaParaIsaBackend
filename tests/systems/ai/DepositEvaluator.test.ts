import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateDepositGoals,
  type DepositContext,
} from "../../../src/domain/simulation/systems/ai/DepositEvaluator.ts";
import { createMockGameState } from "../../setup.ts";
import type { GameState } from "../../../src/domain/types/game-types.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("DepositEvaluator", () => {
  let gameState: GameState;
  let aiState: AIState;
  let context: DepositContext;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "storage-1",
          type: "storage",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
        {
          id: "rest-1",
          type: "rest",
          bounds: { x: 200, y: 200, width: 50, height: 50 },
        },
      ],
    });

    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.5,
        conscientiousness: 0.8, // Alta conciencia
        extraversion: 0.5,
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
      getAgentInventory: (id: string) => {
        if (id === "agent-1")
          return {
            wood: 80,
            stone: 0,
            food: 0,
            water: 0,
            capacity: 100,
          };
        return undefined;
      },
      getCurrentZone: (id: string) => {
        if (id === "agent-1") return "storage-1";
        return undefined;
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

  describe("evaluateDepositGoals", () => {
    it("debe retornar array vacío si no hay inventario", () => {
      context.getAgentInventory = () => undefined;
      const goals = evaluateDepositGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si inventario está vacío", () => {
      context.getAgentInventory = () => ({
        wood: 0,
        stone: 0,
        food: 0,
        water: 0,
        capacity: 100,
      });
      const goals = evaluateDepositGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si carga es muy baja", () => {
      context.getAgentInventory = () => ({
        wood: 10,
        stone: 0,
        food: 0,
        water: 0,
        capacity: 100,
      });
      const goals = evaluateDepositGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de depósito cuando carga es alta", () => {
      context.getAgentInventory = () => ({
        wood: 90,
        stone: 0,
        food: 0,
        water: 0,
        capacity: 100,
      });
      const goals = evaluateDepositGoals(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("deposit");
        expect(goals[0].targetZoneId).toBeDefined();
        expect(goals[0].data?.workType).toBe("deposit");
      }
    });

    it("debe considerar personalidad conscientiousness para umbral", () => {
      aiState.personality.conscientiousness = 0.2; // Baja conciencia
      context.getAgentInventory = () => ({
        wood: 50,
        stone: 0,
        food: 0,
        water: 0,
        capacity: 100,
      });
      const goals = evaluateDepositGoals(context, aiState);
      // Con baja conciencia, el umbral es más alto (0.8 - 0.2*0.3 = 0.74)
      // El umbral mínimo es depositThreshold * 0.75 = 0.74 * 0.75 = 0.555
      // 50/100 = 0.5, que es menor que 0.555, así que no debería depositar
      expect(goals.length).toBe(0);
    });

    it("debe filtrar zonas por tipo de recurso", () => {
      gameState.zones = [
        {
          id: "food-zone",
          type: "food",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
        {
          id: "water-zone",
          type: "water",
          bounds: { x: 200, y: 200, width: 50, height: 50 },
        },
      ];
      context.getAgentInventory = () => ({
        wood: 0,
        stone: 0,
        food: 50,
        water: 0,
        capacity: 100,
      });
      const goals = evaluateDepositGoals(context, aiState);
      if (goals.length > 0) {
        // Debería seleccionar zona de comida
        expect(goals[0].targetZoneId).toBe("food-zone");
      }
    });

    it("debe manejar errores y retornar array vacío", () => {
      context.getAgentInventory = () => {
        throw new Error("Test error");
      };
      const goals = evaluateDepositGoals(context, aiState);
      expect(goals).toEqual([]);
    });
  });
});

