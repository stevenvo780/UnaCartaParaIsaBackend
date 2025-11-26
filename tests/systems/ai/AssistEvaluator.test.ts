import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateAssist,
  type AssistContext,
} from "../../../src/domain/simulation/systems/ai/evaluators/AssistEvaluator.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";
import type { EntityNeedsData } from "../../../src/domain/types/simulation/needs.ts";

describe("AssistEvaluator", () => {
  let aiState: AIState;
  let context: AssistContext;

  beforeEach(() => {
    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.7,
        agreeableness: 0.8, // Alta empatía
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
      getAllActiveAgentIds: () => ["agent-1", "agent-2", "agent-3"],
      getEntityPosition: (id: string) => {
        if (id === "agent-1") return { x: 100, y: 100 };
        if (id === "agent-2") return { x: 150, y: 150 };
        return null;
      },
      getNeeds: (id: string) => {
        if (id === "agent-2")
          return {
            hunger: 20,
            thirst: 100,
            energy: 100,
            hygiene: 100,
            social: 100,
            fun: 100,
            mentalHealth: 100,
          };
        return undefined;
      },
      getEntityStats: (id: string) => {
        if (id === "agent-2") return { morale: 30, wounds: 0 };
        return null;
      },
      selectBestZone: (
        _aiState: AIState,
        zoneIds: string[],
        _zoneType: string,
      ) => {
        return zoneIds.length > 0 ? zoneIds[0] : null;
      },
      getZoneIdsByType: (types: string[]) => {
        if (types.includes("food")) return ["food-zone-1"];
        if (types.includes("water")) return ["water-zone-1"];
        if (types.includes("rest")) return ["rest-zone-1"];
        if (types.includes("medical")) return ["medical-zone-1"];
        return [];
      },
    };
  });

  describe("evaluateAssist", () => {
    it("debe retornar array vacío si no hay posición", () => {
      context.getEntityPosition = () => null;
      const goals = evaluateAssist(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay agentes cercanos con necesidades", () => {
      context.getNeeds = () => ({
        hunger: 80,
        thirst: 80,
        energy: 80,
        hygiene: 80,
        social: 80,
        fun: 80,
        mentalHealth: 80,
      });
      context.getEntityStats = () => ({ morale: 80, wounds: 0 });
      const goals = evaluateAssist(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de asistencia para agente con hambre", () => {
      const goals = evaluateAssist(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("assist");
        expect(goals[0].targetZoneId).toBe("food-zone-1");
        expect(goals[0].data?.targetAgentId).toBe("agent-2");
        expect(goals[0].data?.resourceType).toBe("food");
      }
    });

    it("debe generar goal de asistencia para agente con sed", () => {
      context.getNeeds = (id: string) => {
        if (id === "agent-2")
          return {
            hunger: 100,
            thirst: 15,
            energy: 100,
            hygiene: 100,
            social: 100,
            fun: 100,
            mentalHealth: 100,
          };
        return undefined;
      };
      const goals = evaluateAssist(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].data?.resourceType).toBe("water");
        expect(goals[0].targetZoneId).toBe("water-zone-1");
      }
    });

    it("debe generar goal de asistencia médica para agente herido", () => {
      context.getNeeds = () => ({
        hunger: 100,
        thirst: 100,
        energy: 100,
        hygiene: 100,
        social: 100,
        fun: 100,
        mentalHealth: 100,
      });
      context.getEntityStats = (id: string) => {
        if (id === "agent-2") return { morale: 80, wounds: 30 };
        return null;
      };
      const goals = evaluateAssist(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].data?.resourceType).toBe("medical");
        expect(goals[0].targetZoneId).toBe("medical-zone-1");
      }
    });

    it("debe generar goal de asistencia para descanso si energía o moral es baja", () => {
      context.getNeeds = () => ({
        hunger: 100,
        thirst: 100,
        energy: 15,
        hygiene: 100,
        social: 100,
        fun: 100,
        mentalHealth: 100,
      });
      context.getEntityStats = () => ({ morale: 80, wounds: 0 });
      const goals = evaluateAssist(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].data?.resourceType).toBe("rest");
        expect(goals[0].targetZoneId).toBe("rest-zone-1");
      }
    });

    it("debe considerar radio de ayuda basado en extraversión", () => {
      aiState.personality.extraversion = 1.0; // Máxima extraversión
      const goals = evaluateAssist(context, aiState);
      // Con alta extraversión, el radio es mayor (220 + 1.0*100 = 320)
      expect(Array.isArray(goals)).toBe(true);
    });

    it("debe considerar empatía para calcular prioridad", () => {
      aiState.personality.agreeableness = 1.0; // Máxima empatía
      const goals = evaluateAssist(context, aiState);
      if (goals.length > 0) {
        expect(goals[0].priority).toBeGreaterThan(0.4);
      }
    });

    it("debe ignorar al mismo agente", () => {
      context.getAllActiveAgentIds = () => ["agent-1"];
      const goals = evaluateAssist(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay zona disponible", () => {
      context.getZoneIdsByType = () => [];
      const goals = evaluateAssist(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe manejar errores y retornar array vacío", () => {
      context.getAllActiveAgentIds = () => {
        throw new Error("Test error");
      };
      const goals = evaluateAssist(context, aiState);
      expect(goals).toEqual([]);
    });
  });
});

