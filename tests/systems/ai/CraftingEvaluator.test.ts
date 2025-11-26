import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateCrafting,
  type CraftingContext,
} from "../../../src/domain/simulation/systems/ai/evaluators/CraftingEvaluator.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("CraftingEvaluator", () => {
  let aiState: AIState;
  let context: CraftingContext;

  beforeEach(() => {
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
      getEquipped: (id: string) => {
        if (id === "agent-1") return "unarmed";
        return "wooden_club";
      },
      getSuggestedCraftZone: () => "craft-zone-1",
      canCraftWeapon: (id: string, weaponId: string) => {
        if (id === "agent-1" && weaponId === "wooden_club") return true;
        if (id === "agent-1" && weaponId === "stone_dagger") return true;
        return false;
      },
    };
  });

  describe("evaluateCrafting", () => {
    it("debe retornar array vacío si agente ya tiene arma equipada", () => {
      context.getEquipped = () => "wooden_club";
      const goals = evaluateCrafting(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no puede craftar ninguna arma", () => {
      context.canCraftWeapon = () => false;
      const goals = evaluateCrafting(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe retornar array vacío si no hay zona de crafting", () => {
      context.getSuggestedCraftZone = () => undefined;
      const goals = evaluateCrafting(context, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de crafting cuando condiciones se cumplen", () => {
      // Ejecutar múltiples veces para aumentar probabilidad
      let crafted = false;
      for (let i = 0; i < 20; i++) {
        const goals = evaluateCrafting(context, aiState);
        if (goals.length > 0) {
          crafted = true;
          expect(goals[0].type).toBe("craft");
          expect(goals[0].targetZoneId).toBe("craft-zone-1");
          expect(goals[0].data?.itemType).toBe("weapon");
          break;
        }
      }
      // Con alta apertura y neuroticismo, debería craftar al menos una vez
      expect(crafted).toBe(true);
    });

    it("debe preferir wooden_club sobre stone_dagger si ambos están disponibles", () => {
      let clubCrafted = false;
      for (let i = 0; i < 30; i++) {
        const goals = evaluateCrafting(context, aiState);
        if (goals.length > 0 && goals[0].data?.itemId === "wooden_club") {
          clubCrafted = true;
          break;
        }
      }
      // Debería craftar club si está disponible
      expect(clubCrafted).toBe(true);
    });

    it("debe manejar errores y retornar array vacío", () => {
      context.canCraftWeapon = () => {
        throw new Error("Test error");
      };
      const goals = evaluateCrafting(context, aiState);
      expect(goals).toEqual([]);
    });
  });
});

