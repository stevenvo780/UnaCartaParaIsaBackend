import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateCriticalNeeds,
  calculateNeedPriority,
  type NeedsEvaluatorDependencies,
} from "../../../src/domain/simulation/systems/ai/evaluators/NeedsEvaluator.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";
import type { EntityNeedsData } from "../../../src/domain/types/simulation/needs.ts";

describe("NeedsEvaluator", () => {
  let aiState: AIState;
  let deps: NeedsEvaluatorDependencies;

  beforeEach(() => {
    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
      },
      memory: {
        successfulActivities: [],
        failedAttempts: [],
      },
      currentGoal: null,
      strategy: "peaceful",
    };

    deps = {
      getEntityNeeds: (id: string) => {
        if (id === "agent-1") {
          return {
            hunger: 50,
            thirst: 50,
            energy: 50,
            mentalHealth: 50,
            hygiene: 50,
            social: 50,
            fun: 50,
          };
        }
        return undefined;
      },
      findNearestResource: (
        _entityId: string,
        resourceType: string,
      ) => {
        if (resourceType === "water_source") {
          return { id: "water-1", x: 100, y: 100 };
        }
        if (resourceType === "wheat_crop") {
          return { id: "wheat-1", x: 200, y: 200 };
        }
        if (resourceType === "berry_bush") {
          return { id: "berry-1", x: 300, y: 300 };
        }
        if (resourceType === "mushroom_patch") {
          return { id: "mushroom-1", x: 400, y: 400 };
        }
        return null;
      },
    };
  });

  describe("calculateNeedPriority", () => {
    it("debe retornar 0 para valores >= 80", () => {
      expect(calculateNeedPriority(80)).toBe(0);
      expect(calculateNeedPriority(90)).toBe(0);
      expect(calculateNeedPriority(100)).toBe(0);
    });

    it("debe retornar 0.2 para valores >= 60 y < 80", () => {
      expect(calculateNeedPriority(60)).toBe(0.2);
      expect(calculateNeedPriority(70)).toBe(0.2);
      expect(calculateNeedPriority(79)).toBe(0.2);
    });

    it("debe retornar 0.5 para valores >= 40 y < 60", () => {
      expect(calculateNeedPriority(40)).toBe(0.5);
      expect(calculateNeedPriority(50)).toBe(0.5);
      expect(calculateNeedPriority(59)).toBe(0.5);
    });

    it("debe retornar 0.8 para valores >= 20 y < 40", () => {
      expect(calculateNeedPriority(20)).toBe(0.8);
      expect(calculateNeedPriority(30)).toBe(0.8);
      expect(calculateNeedPriority(39)).toBe(0.8);
    });

    it("debe retornar 1.0 * (urgencyMultiplier/100) para valores < 20", () => {
      expect(calculateNeedPriority(10, 100)).toBe(1.0);
      expect(calculateNeedPriority(15, 80)).toBe(0.8);
      expect(calculateNeedPriority(5, 120)).toBe(1.2);
    });

    it("debe usar urgencyMultiplier por defecto de 100", () => {
      expect(calculateNeedPriority(10)).toBe(1.0);
    });
  });

  describe("evaluateCriticalNeeds", () => {
    it("debe retornar array vacío si no hay necesidades", () => {
      deps.getEntityNeeds = () => undefined;
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si todas las necesidades están por encima del umbral", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50, // >= 45
        thirst: 45, // >= 40
        energy: 40, // >= 35
        mentalHealth: 60, // >= 50
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de sed cuando thirst < 40", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 30, // < 40
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe("gather");
      expect(goals[0].data?.need).toBe("thirst");
      expect(goals[0].data?.resourceType).toBe("water_source");
      expect(goals[0].targetId).toBe("water-1");
      expect(goals[0].targetPosition).toEqual({ x: 100, y: 100 });
    });

    it("debe generar goal de hambre cuando hunger < 45", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30, // < 45
        thirst: 50,
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe("gather");
      expect(goals[0].data?.need).toBe("hunger");
      expect(goals[0].data?.resourceType).toBe("wheat_crop");
      expect(goals[0].targetId).toBe("wheat-1");
      expect(goals[0].targetPosition).toEqual({ x: 200, y: 200 });
    });

    it("debe buscar berry_bush si no hay wheat", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30,
        thirst: 50,
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      deps.findNearestResource = (
        _entityId: string,
        resourceType: string,
      ) => {
        if (resourceType === "wheat") return null;
        if (resourceType === "berry_bush") {
          return { id: "berry-1", x: 300, y: 300 };
        }
        return null;
      };
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].targetId).toBe("berry-1");
      expect(goals[0].targetPosition).toEqual({ x: 300, y: 300 });
    });

    it("debe buscar mushroom_patch si no hay wheat ni berry_bush", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30,
        thirst: 50,
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      deps.findNearestResource = (
        _entityId: string,
        resourceType: string,
      ) => {
        if (resourceType === "wheat") return null;
        if (resourceType === "berry_bush") return null;
        if (resourceType === "mushroom_patch") {
          return { id: "mushroom-1", x: 400, y: 400 };
        }
        return null;
      };
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].targetId).toBe("mushroom-1");
      expect(goals[0].targetPosition).toEqual({ x: 400, y: 400 });
    });

    it("debe generar goal de exploración desesperada si no hay recursos de comida disponibles", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30,
        thirst: 50,
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      deps.findNearestResource = () => null;
      const goals = evaluateCriticalNeeds(deps, aiState);
      // La implementación genera un goal de "desperate_search" cuando no hay recursos
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe("explore");
      expect(goals[0].data?.explorationType).toBe("desperate_search");
      expect(goals[0].data?.need).toBe("hunger");
    });

    it("debe generar goal de energía cuando energy < 35", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 50,
        energy: 20, // < 35
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe("satisfy_need");
      expect(goals[0].data?.need).toBe("energy");
      expect(goals[0].data?.action).toBe("rest");
      expect(goals[0].targetId).toBeUndefined();
      expect(goals[0].targetPosition).toBeUndefined();
    });

    it("debe generar goal de salud mental cuando mentalHealth < 50", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 50,
        energy: 50,
        mentalHealth: 30, // < 50
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe("social");
      expect(goals[0].data?.need).toBe("mentalHealth");
    });

    it("debe generar múltiples goals si hay múltiples necesidades críticas", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30, // < 45
        thirst: 30, // < 40
        energy: 20, // < 35
        mentalHealth: 30, // < 50
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals.length).toBe(4);
      const goalTypes = goals.map((g) => g.data?.need);
      expect(goalTypes).toContain("thirst");
      expect(goalTypes).toContain("hunger");
      expect(goalTypes).toContain("energy");
      expect(goalTypes).toContain("mentalHealth");
    });

    it("debe calcular prioridad correcta para sed con urgencyMultiplier 130", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 10, // < 40, prioridad debería ser 1.0 * (130/100) = 1.3
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals[0].priority).toBe(1.3);
    });

    it("debe calcular prioridad correcta para hambre con urgencyMultiplier 110", () => {
      deps.getEntityNeeds = () => ({
        hunger: 10, // < 45, prioridad debería ser 1.0 * (110/100) = 1.1
        thirst: 50,
        energy: 50,
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals[0].priority).toBe(1.1);
    });

    it("debe calcular prioridad correcta para energía con urgencyMultiplier 80", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 50,
        energy: 10, // < 35, prioridad debería ser 1.0 * (80/100) = 0.8
        mentalHealth: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals[0].priority).toBe(0.8);
    });

    it("debe calcular prioridad correcta para salud mental con urgencyMultiplier 70", () => {
      deps.getEntityNeeds = () => ({
        hunger: 50,
        thirst: 50,
        energy: 50,
        mentalHealth: 10, // < 50, prioridad debería ser 1.0 * (70/100) = 0.7
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const goals = evaluateCriticalNeeds(deps, aiState);
      expect(goals[0].priority).toBe(0.7);
    });

    it("debe funcionar sin findNearestResource", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30,
        thirst: 30,
        energy: 20,
        mentalHealth: 30,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      deps.findNearestResource = undefined;
      const goals = evaluateCriticalNeeds(deps, aiState);
      // La implementación genera goals de "desperate_search" para hambre y sed cuando no hay findNearestResource
      // Además de goals para energía y salud mental
      expect(goals.length).toBe(4);
      const goalTypes = goals.map((g) => g.data?.need);
      expect(goalTypes).toContain("energy");
      expect(goalTypes).toContain("mentalHealth");
      // También genera goals de exploración desesperada para hambre y sed
      const exploreGoals = goals.filter((g) => g.type === "explore");
      expect(exploreGoals.length).toBeGreaterThan(0);
    });

    it("debe incluir timestamps y expiración en los goals", () => {
      deps.getEntityNeeds = () => ({
        hunger: 30,
        thirst: 30,
        energy: 20,
        mentalHealth: 30,
        hygiene: 50,
        social: 50,
        fun: 50,
      });
      const before = Date.now();
      const goals = evaluateCriticalNeeds(deps, aiState);
      const after = Date.now();

      goals.forEach((goal) => {
        expect(goal.createdAt).toBeGreaterThanOrEqual(before);
        expect(goal.createdAt).toBeLessThanOrEqual(after);
        expect(goal.expiresAt).toBeGreaterThan(goal.createdAt);
      });
    });
  });
});

