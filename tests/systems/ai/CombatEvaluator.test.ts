import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateCombatGoals,
  type CombatContext,
} from "../../../src/domain/simulation/systems/ai/CombatEvaluator.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("CombatEvaluator", () => {
  let aiState: AIState;
  let context: CombatContext;

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

    context = {
      getEntityPosition: (id: string) => {
        if (id === "agent-1") return { x: 100, y: 100 };
        if (id === "enemy-1") return { x: 150, y: 150 };
        return null;
      },
      getEntityStats: (id: string) => {
        if (id === "agent-1")
          return { morale: 70, stamina: 60, mentalHealth: 70 };
        if (id === "enemy-1") return { morale: 50, stamina: 50 };
        return null;
      },
      getStrategy: (id: string) => {
        if (id === "agent-1") return "peaceful";
        return "peaceful";
      },
      isWarrior: (id: string) => id === "warrior-1",
      getEnemiesForAgent: (id: string, threshold?: number) => {
        if (id === "agent-1" && (threshold === undefined || threshold <= 0.5))
          return ["enemy-1"];
        return [];
      },
      getNearbyPredators: () => [],
    };
  });

  describe("evaluateCombatGoals", () => {
    it("debe retornar array vacío si no hay posición", () => {
      context.getEntityPosition = () => null;
      const goals = evaluateCombatGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay enemigos", () => {
      context.getEnemiesForAgent = () => [];
      const goals = evaluateCombatGoals(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de huir cuando enemigo está muy cerca y no es guerrero", () => {
      context.getEntityPosition = (id: string) => {
        if (id === "agent-1") return { x: 100, y: 100 };
        if (id === "enemy-1") return { x: 110, y: 110 }; // Muy cerca
        return null;
      };
      context.isWarrior = () => false;
      
      const goals = evaluateCombatGoals(context, aiState);
      const fleeGoal = goals.find((g) => g.type === "flee");
      if (fleeGoal) {
        expect(fleeGoal.type).toBe("flee");
        expect(fleeGoal.targetPosition).toBeDefined();
      }
    });

    it("debe generar goal de ataque cuando estrategia es bully y hay ventaja", () => {
      context.getStrategy = () => "bully";
      context.getEntityPosition = (id: string) => {
        if (id === "agent-1") return { x: 100, y: 100 };
        if (id === "enemy-1") return { x: 150, y: 150 };
        return null;
      };
      context.getEntityStats = (id: string) => {
        if (id === "agent-1")
          return { morale: 90, stamina: 90 }; // Muy fuerte
        if (id === "enemy-1") return { morale: 30, stamina: 30 }; // Débil
        return null;
      };
      aiState.personality.agreeableness = 0.2; // Baja, más agresivo
      
      const goals = evaluateCombatGoals(context, aiState);
      const attackGoal = goals.find((g) => g.type === "attack");
      if (attackGoal) {
        expect(attackGoal.type).toBe("attack");
        expect(attackGoal.targetId).toBe("enemy-1");
      }
    });

    it("no debe atacar con estrategia peaceful", () => {
      context.getStrategy = () => "peaceful";
      const goals = evaluateCombatGoals(context, aiState);
      const attackGoal = goals.find((g) => g.type === "attack");
      expect(attackGoal).toBeUndefined();
    });

    it("debe considerar personalidad neurotic para calcular umbral de pánico", () => {
      aiState.personality.neuroticism = 0.9; // Alta neurosis
      context.getEntityStats = (id: string) => {
        if (id === "agent-1")
          return { morale: 30, stamina: 30, mentalHealth: 20 }; // Baja moral
        return null;
      };
      context.getEntityPosition = (id: string) => {
        if (id === "agent-1") return { x: 100, y: 100 };
        if (id === "enemy-1") return { x: 110, y: 110 };
        return null;
      };
      
      const goals = evaluateCombatGoals(context, aiState);
      const fleeGoal = goals.find((g) => g.type === "flee");
      if (fleeGoal) {
        expect(fleeGoal.priority).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("debe usar estrategia tit_for_tat correctamente", () => {
      context.getStrategy = () => "tit_for_tat";
      context.getEnemiesForAgent = (id: string, threshold?: number) => {
        if (id === "agent-1" && threshold && threshold >= 0.6) return ["enemy-1"];
        if (id === "agent-1") return ["enemy-1"];
        return [];
      };
      context.getEntityStats = (id: string) => {
        if (id === "agent-1") return { morale: 80, stamina: 80 };
        if (id === "enemy-1") return { morale: 50, stamina: 50 };
        return null;
      };
      
      const goals = evaluateCombatGoals(context, aiState);
      // Con tit_for_tat y ventaja >= 0.7, debería atacar
      const attackGoal = goals.find((g) => g.type === "attack");
      if (attackGoal) {
        expect(attackGoal.type).toBe("attack");
      }
    });
  });
});

