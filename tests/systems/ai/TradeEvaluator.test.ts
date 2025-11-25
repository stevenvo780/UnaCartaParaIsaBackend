import { describe, it, expect, beforeEach } from "vitest";
import { evaluateTradeGoals } from "../../../src/domain/simulation/systems/ai/TradeEvaluator";
import type { AIState } from "../../../src/domain/types/simulation/ai";

describe("TradeEvaluator", () => {
  let aiState: AIState;

  beforeEach(() => {
    aiState = {
      entityId: "agent-1",
      agentId: "agent-1",
      position: { x: 0, y: 0 },
      zoneId: null,
      currentGoal: null,
      memory: {},
      needs: {},
    };
  });

  it("debe generar goal de trade cuando hay recursos excedentes", () => {
    const goals = evaluateTradeGoals(
      {
        getAgentInventory: () => ({
          wood: 25,
          stone: 5,
        }),
        getEntityPosition: () => ({ x: 0, y: 0 }),
        getAllActiveAgentIds: () => ["agent-1", "agent-2"],
        gameState: {
          zones: [
            {
              id: "market-1",
              type: "market",
              bounds: { x: 100, y: 0, width: 50, height: 50 },
            },
          ],
        },
      },
      aiState,
    );

    expect(goals).toHaveLength(1);
    expect(goals[0].id).toContain("trade_agent-1");
    expect(goals[0].type).toBe("work");
    expect(goals[0].targetZoneId).toBe("market-1");
    expect(goals[0].data?.action).toBe("trade");
  });

  it("debe retornar vacío cuando no hay inventario", () => {
    const goals = evaluateTradeGoals(
      {
        getAgentInventory: () => undefined,
        getEntityPosition: () => ({ x: 0, y: 0 }),
        getAllActiveAgentIds: () => [],
        gameState: { zones: [] },
      },
      aiState,
    );

    expect(goals).toEqual([]);
  });

  it("debe retornar vacío cuando no hay recursos excedentes", () => {
    const goals = evaluateTradeGoals(
      {
        getAgentInventory: () => ({ wood: 5, stone: 5 }),
        getEntityPosition: () => ({ x: 0, y: 0 }),
        getAllActiveAgentIds: () => [],
        gameState: {
          zones: [
            {
              id: "market-1",
              type: "market",
              bounds: { x: 0, y: 0, width: 50, height: 50 },
            },
          ],
        },
      },
      aiState,
    );

    expect(goals).toEqual([]);
  });
});

