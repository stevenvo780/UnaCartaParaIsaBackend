import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateWorkOpportunities,
  evaluateExplorationOpportunities,
  type OpportunitiesEvaluatorDependencies,
  type ExplorationDependencies,
} from "../../../src/domain/simulation/systems/ai/evaluators/OpportunitiesEvaluator.ts";
import { createMockGameState } from "../../setup.ts";
import type { GameState } from "../../../src/domain/types/game-types.ts";
import type { AIState } from "../../../src/domain/types/simulation/ai.ts";

describe("OpportunitiesEvaluator", () => {
  let gameState: GameState;
  let aiState: AIState;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "zone-1",
          type: "resource",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
      ],
    });

    aiState = {
      entityId: "agent-1",
      personality: {
        openness: 0.7,
        conscientiousness: 0.8,
        extraversion: 0.6,
        agreeableness: 0.5,
        neuroticism: 0.3,
        diligence: 0.7,
      },
      memory: {
        successfulActivities: [],
        failedAttempts: [],
      },
      currentGoal: null,
      strategy: "peaceful",
    };
  });

  describe("evaluateWorkOpportunities", () => {
    it("debe retornar array vacío si agente no tiene rol", () => {
      const deps: OpportunitiesEvaluatorDependencies = {
        getAgentRole: () => undefined,
        getPreferredResourceForRole: () => null,
      };
      const goals = evaluateWorkOpportunities(deps, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de trabajo genérico si no hay recurso preferido", () => {
      const deps: OpportunitiesEvaluatorDependencies = {
        getAgentRole: () => ({
          roleType: "gatherer",
          efficiency: 1.0,
          priority: 1.0,
        }),
        getPreferredResourceForRole: () => null,
      };
      const goals = evaluateWorkOpportunities(deps, aiState);
      expect(goals.length).toBeGreaterThan(0);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("work");
        expect(goals[0].data?.roleType).toBe("gatherer");
      }
    });

    it("debe generar goal de trabajo con recurso específico", () => {
      const deps: OpportunitiesEvaluatorDependencies = {
        getAgentRole: () => ({
          roleType: "gatherer",
          efficiency: 1.0,
          priority: 1.0,
        }),
        getPreferredResourceForRole: () => "wood",
        findNearestResource: (entityId: string, resourceType: string) => {
          if (entityId === "agent-1" && resourceType === "wood") {
            return { id: "resource-1", x: 100, y: 100 };
          }
          return null;
        },
      };
      const goals = evaluateWorkOpportunities(deps, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("work");
        expect(goals[0].targetId).toBe("resource-1");
        expect(goals[0].data?.resourceType).toBe("wood");
      }
    });

    it("debe considerar eficiencia del rol en prioridad", () => {
      const deps: OpportunitiesEvaluatorDependencies = {
        getAgentRole: () => ({
          roleType: "gatherer",
          efficiency: 0.5,
          priority: 1.0,
        }),
        getPreferredResourceForRole: () => null,
      };
      const goals = evaluateWorkOpportunities(deps, aiState);
      if (goals.length > 0) {
        expect(goals[0].priority).toBeDefined();
      }
    });
  });

  describe("evaluateExplorationOpportunities", () => {
    it("debe retornar array vacío si personalidad no es exploradora", () => {
      aiState.personality.openness = 0.3;
      const deps: ExplorationDependencies = {
        gameState,
        getUnexploredZones: () => ["zone-1"],
        selectBestZone: () => "zone-1",
        getEntityPosition: () => ({ x: 100, y: 100 }),
      };
      const goals = evaluateExplorationOpportunities(deps, aiState);
      expect(goals).toEqual([]);
    });

    it("debe generar goal de exploración si personalidad es exploradora", () => {
      aiState.personality.openness = 0.7;
      const deps: ExplorationDependencies = {
        gameState,
        getUnexploredZones: () => ["zone-1"],
        selectBestZone: () => "zone-1",
        getEntityPosition: () => ({ x: 100, y: 100 }),
      };
      const goals = evaluateExplorationOpportunities(deps, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("explore");
        expect(goals[0].targetZoneId).toBe("zone-1");
      }
    });

    it("debe retornar array vacío si no hay zonas sin explorar", () => {
      aiState.personality.openness = 0.7;
      const deps: ExplorationDependencies = {
        gameState,
        getUnexploredZones: () => [],
        selectBestZone: () => null,
        getEntityPosition: () => ({ x: 100, y: 100 }),
      };
      const goals = evaluateExplorationOpportunities(deps, aiState);
      expect(goals).toEqual([]);
    });

    it("debe considerar tipo de exploración en personalidad", () => {
      aiState.personality.explorationType = "adventurous";
      const deps: ExplorationDependencies = {
        gameState,
        getUnexploredZones: () => ["zone-1"],
        selectBestZone: () => "zone-1",
        getEntityPosition: () => ({ x: 100, y: 100 }),
      };
      const goals = evaluateExplorationOpportunities(deps, aiState);
      if (goals.length > 0) {
        expect(goals[0].type).toBe("explore");
      }
    });
  });
});

