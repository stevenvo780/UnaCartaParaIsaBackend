import { describe, it, expect } from "vitest";
import { evaluateBuildingContributionGoals } from "../../../src/domain/simulation/systems/ai/BuildingContributionEvaluator";
import type { AIState } from "../../../src/domain/types/simulation/ai";

describe("BuildingContributionEvaluator", () => {
  const aiState: AIState = {
    entityId: "agent-1",
    agentId: "agent-1",
    position: { x: 0, y: 0 },
    zoneId: null,
    currentGoal: null,
    memory: {},
    needs: {},
  };

  const baseZone = {
    id: "zone-1",
    type: "residential",
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    metadata: { underConstruction: true, building: "house" },
  };

  it("debe generar goal cuando hay construcción activa y recursos disponibles", () => {
    const goals = evaluateBuildingContributionGoals(
      {
        gameState: { zones: [baseZone] } as any,
        getEntityPosition: () => ({ x: 10, y: 10 }),
        getAgentInventory: () => ({ wood: 10, stone: 2 }),
      },
      aiState,
    );

    expect(goals).toHaveLength(1);
    expect(goals[0].type).toBe("work");
    expect(goals[0].targetZoneId).toBe("zone-1");
    expect(goals[0].data?.buildingType).toBe("house");
  });

  it("debe retornar vacío cuando no hay recursos suficientes", () => {
    const goals = evaluateBuildingContributionGoals(
      {
        gameState: { zones: [baseZone] } as any,
        getEntityPosition: () => ({ x: 10, y: 10 }),
        getAgentInventory: () => ({ wood: 2, stone: 2 }),
      },
      aiState,
    );

    expect(goals).toEqual([]);
  });

  it("debe retornar vacío cuando no hay zonas en construcción", () => {
    const goals = evaluateBuildingContributionGoals(
      {
        gameState: {
          zones: [
            {
              ...baseZone,
              metadata: { underConstruction: false },
            },
          ],
        } as any,
        getEntityPosition: () => ({ x: 0, y: 0 }),
        getAgentInventory: () => ({ wood: 10 }),
      },
      aiState,
    );

    expect(goals).toEqual([]);
  });
});

