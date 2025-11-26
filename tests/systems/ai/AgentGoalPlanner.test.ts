import { describe, it, expect, beforeEach, vi } from "vitest";
import { planGoals } from "../../../src/domain/simulation/systems/ai/AgentGoalPlanner";
import { createMockGameState } from "../../setup";
import type { GameState } from "../../../src/domain/types/game-types";
import type { AIState } from "../../../src/domain/types/simulation/ai";

vi.mock("../../../src/domain/simulation/systems/ai/NeedsEvaluator", () => ({
  evaluateCriticalNeeds: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/OpportunitiesEvaluator", () => ({
  evaluateWorkOpportunities: vi.fn(() => []),
  evaluateExplorationOpportunities: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/AssistEvaluator", () => ({
  evaluateAssist: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/CombatEvaluator", () => ({
  evaluateCombatGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/ConstructionEvaluator", () => ({
  evaluateConstructionGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/DepositEvaluator", () => ({
  evaluateDepositGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/CraftingEvaluator", () => ({
  evaluateCrafting: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/AttentionEvaluator", () => ({
  evaluateAttention: vi.fn(() => []),
  evaluateDefaultExploration: vi.fn(() => [
    { id: "default", description: "default", priority: 0.5, type: "explore" },
  ]),
}));

vi.mock("../../../src/domain/simulation/systems/ai/QuestEvaluator", () => ({
  evaluateQuestGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/TradeEvaluator", () => ({
  evaluateTradeGoals: vi.fn(() => []),
}));

vi.mock(
  "../../../src/domain/simulation/systems/ai/BuildingContributionEvaluator",
  () => ({
    evaluateBuildingContributionGoals: vi.fn(() => []),
  }),
);

vi.mock("../../../src/domain/simulation/systems/ai/utils", () => ({
  selectBestZone: vi.fn(() => null),
  getUnexploredZones: vi.fn(() => []),
  prioritizeGoals: vi
    .fn()
    .mockImplementation(
      (
        goals,
        _aiState,
        _priorityManager,
        minPriority: number,
      ) => goals.filter((goal) => goal.priority >= minPriority),
    ),
  getEntityPosition: vi.fn(() => ({ x: 0, y: 0 })),
}));

import { evaluateCriticalNeeds } from "../../../src/domain/simulation/systems/ai/NeedsEvaluator";
import {
  evaluateWorkOpportunities,
  evaluateExplorationOpportunities,
} from "../../../src/domain/simulation/systems/ai/OpportunitiesEvaluator";
import { evaluateAttention, evaluateDefaultExploration } from "../../../src/domain/simulation/systems/ai/AttentionEvaluator";
import { prioritizeGoals } from "../../../src/domain/simulation/systems/ai/utils";

describe("AgentGoalPlanner", () => {
  let gameState: GameState;
  let aiState: AIState;

  const baseDeps = () => ({
    gameState,
    priorityManager: {
      adjust: vi.fn((_agentId: string, _domain: string, priority: number) => priority),
    } as any,
    getEntityNeeds: vi.fn(() => ({
      hunger: 50,
      thirst: 50,
      energy: 50,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gameState = createMockGameState();
    aiState = {
      entityId: "agent-1",
      agentId: "agent-1",
      position: { x: 0, y: 0 },
      zoneId: null,
      currentGoal: null,
      memory: {},
      needs: {},
    };
    vi.mocked(evaluateCriticalNeeds).mockReturnValue([]);
    vi.mocked(evaluateWorkOpportunities).mockReturnValue([]);
    vi.mocked(evaluateExplorationOpportunities).mockReturnValue([]);
    vi.mocked(evaluateAttention).mockReturnValue([]);
    vi.mocked(evaluateDefaultExploration).mockReturnValue([
      { id: "default", description: "default", priority: 0.6, type: "explore" },
    ]);
    vi.mocked(prioritizeGoals).mockImplementation(
      (goals, _ai, _manager, minPriority) =>
        goals.filter((goal) => goal.priority >= minPriority),
    );
  });

  it("debe agregar objetivos críticos de necesidades", () => {
    vi.mocked(evaluateCriticalNeeds).mockReturnValue([
      { id: "critical", description: "critical", priority: 0.9, type: "need" },
    ]);

    const deps = baseDeps();
    const goals = planGoals(deps, aiState, Date.now());

    expect(evaluateCriticalNeeds).toHaveBeenCalled();
    expect(goals.some((goal) => goal.id === "critical")).toBe(true);
  });

  it("debe incluir work opportunities cuando no hay críticos altos", () => {
    vi.mocked(evaluateCriticalNeeds).mockReturnValue([
      { id: "low-critical", description: "low", priority: 0.5, type: "need" },
    ]);
    vi.mocked(evaluateWorkOpportunities).mockReturnValue([
      { id: "work", description: "work", priority: 0.6, type: "work" },
    ]);
    vi.mocked(evaluateExplorationOpportunities).mockReturnValue([
      { id: "explore", description: "explore", priority: 0.5, type: "explore" },
    ]);

    const deps = {
      ...baseDeps(),
      getAgentRole: vi.fn(() => ({ roleType: "worker" })),
      getPreferredResourceForRole: vi.fn(() => "wood"),
      findNearestResource: vi.fn(() => ({ id: "resource", x: 10, y: 10 })),
      getCurrentTimeOfDay: vi.fn(() => "morning"),
    };

    const goals = planGoals(deps, aiState, Date.now(), 0.3);

    expect(evaluateWorkOpportunities).toHaveBeenCalled();
    expect(goals.some((goal) => goal.id === "work")).toBe(true);
  });

  it("debe respetar minPriority al priorizar objetivos", () => {
    vi.mocked(evaluateCriticalNeeds).mockReturnValue([
      { id: "below", description: "below", priority: 0.2, type: "need" },
      { id: "above", description: "above", priority: 0.8, type: "need" },
    ]);

    const deps = baseDeps();
    const goals = planGoals(deps, aiState, Date.now(), 0.5);

    expect(prioritizeGoals).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "below" }),
        expect.objectContaining({ id: "above" }),
      ]),
      aiState,
      deps.priorityManager,
      0.5,
      0.1,
    );
    expect(goals.some((goal) => goal.id === "above")).toBe(true);
    expect(goals.some((goal) => goal.id === "below")).toBe(false);
  });

  it("debe retornar default goals cuando no hay otros", () => {
    vi.mocked(evaluateCriticalNeeds).mockReturnValue([]);
    vi.mocked(evaluateAttention).mockReturnValue([]);
    vi.mocked(evaluateDefaultExploration).mockReturnValue([
      { id: "default", description: "default", priority: 0.6, type: "explore" },
    ]);

    const deps = {
      ...baseDeps(),
      getEntityNeeds: vi.fn(() => undefined),
    };

    const goals = planGoals(deps, aiState, Date.now());

    expect(goals.some((goal) => goal.id === "default")).toBe(true);
  });
});

