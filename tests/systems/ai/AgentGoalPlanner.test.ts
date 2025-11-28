import { describe, it, expect, beforeEach, vi } from "vitest";
import { planGoals } from "../../../src/domain/simulation/systems/ai/core/AgentGoalPlanner";
import { createMockGameState } from "../../setup";
import type { GameState } from "../../../src/domain/types/game-types";
import type { AIState, AIGoal } from "../../../src/domain/types/simulation/ai";
import { WorkEthic, ExplorationType } from "../../../src/shared/constants/AgentEnums";
import { GoalType } from "../../../src/shared/constants/AIEnums";

// Mock the new evaluators
vi.mock("../../../src/domain/simulation/systems/ai/evaluators/BiologicalDriveEvaluator", () => ({
  evaluateBiologicalDrives: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/ReproductionEvaluator", () => ({
  evaluateReproductionDrive: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/SocialDriveEvaluator", () => ({
  evaluateSocialDrives: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/CognitiveDriveEvaluator", () => ({
  evaluateCognitiveDrives: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/OpportunitiesEvaluator", () => ({
  evaluateWorkOpportunities: vi.fn(() => []),
  evaluateExplorationOpportunities: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/AssistEvaluator", () => ({
  evaluateAssist: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/CombatEvaluator", () => ({
  evaluateCombatGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/ConstructionEvaluator", () => ({
  evaluateConstructionGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/DepositEvaluator", () => ({
  evaluateDepositGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/CraftingEvaluator", () => ({
  evaluateCrafting: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/AttentionEvaluator", () => ({
  evaluateAttention: vi.fn(() => []),
  evaluateDefaultExploration: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/QuestEvaluator", () => ({
  evaluateQuestGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/TradeEvaluator", () => ({
  evaluateTradeGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/BuildingContributionEvaluator", () => ({
  evaluateBuildingContributionGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/CollectiveNeedsEvaluator", () => ({
  evaluateCollectiveNeeds: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/evaluators/ExpansionEvaluator", () => ({
  evaluateExpansionGoals: vi.fn(() => []),
}));

vi.mock("../../../src/domain/simulation/systems/ai/core/utils", () => ({
  selectBestZone: vi.fn(() => null),
  getUnexploredZones: vi.fn(() => []),
  prioritizeGoals: vi.fn().mockImplementation(
    (goals: AIGoal[], _aiState: AIState, _priorityManager: unknown, minPriority: number) =>
      goals.filter((goal) => goal.priority >= minPriority),
  ),
}));

import { evaluateBiologicalDrives } from "../../../src/domain/simulation/systems/ai/evaluators/BiologicalDriveEvaluator";
import { evaluateCognitiveDrives } from "../../../src/domain/simulation/systems/ai/evaluators/CognitiveDriveEvaluator";
import { evaluateDefaultExploration } from "../../../src/domain/simulation/systems/ai/evaluators/AttentionEvaluator";
import { prioritizeGoals } from "../../../src/domain/simulation/systems/ai/core/utils";

function createTestGoal(overrides: Partial<AIGoal> & { id: string; type: GoalType; priority: number }): AIGoal {
  return {
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
    ...overrides,
  };
}

describe("AgentGoalPlanner", () => {
  let gameState: GameState;
  let aiState: AIState;

  const createMockAgentRegistry = () => ({
    getPosition: vi.fn(() => ({ x: 0, y: 0 })),
    getProfile: vi.fn(() => null),
    getAllProfiles: vi.fn(() => []),
  });

  const baseDeps = () => ({
    gameState,
    priorityManager: {
      adjust: vi.fn((_agentId: string, _domain: string, priority: number) => priority),
    } as unknown,
    agentRegistry: createMockAgentRegistry() as unknown,
    getEntityNeeds: vi.fn(() => ({
      hunger: 50,
      thirst: 50,
      energy: 50,
      hygiene: 50,
      social: 50,
      fun: 50,
      mentalHealth: 50,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gameState = createMockGameState();
    aiState = {
      entityId: "agent-1",
      position: { x: 0, y: 0 },
      zoneId: null,
      currentGoal: null,
      memory: {},
      needs: {},
      personality: {
        workEthic: WorkEthic.BALANCED,
        explorationType: ExplorationType.ADVENTUROUS,
        cooperation: 0.5,
        diligence: 0.5,
        curiosity: 0.5,
        aggression: 0.1,
        sociability: 0.5,
      },
      goalQueue: [],
      lastDecisionTime: 0,
      offDuty: false,
    } as unknown as AIState;

    vi.mocked(evaluateBiologicalDrives).mockReturnValue([]);
    vi.mocked(evaluateCognitiveDrives).mockReturnValue([]);
    vi.mocked(evaluateDefaultExploration).mockReturnValue([
      createTestGoal({ id: "default", type: GoalType.EXPLORE, priority: 0.6 }),
    ]);
    vi.mocked(prioritizeGoals).mockImplementation(
      (goals: AIGoal[], _ai, _manager, minPriority) =>
        goals.filter((goal) => goal.priority >= minPriority),
    );
  });

  it("debe evaluar necesidades biológicas críticas", async () => {
    vi.mocked(evaluateBiologicalDrives).mockReturnValue([
      createTestGoal({ id: "critical_hunger", type: GoalType.SATISFY_HUNGER, priority: 0.95 }),
    ]);

    const deps = baseDeps();
    const goals = await planGoals(deps as any, aiState, Date.now());

    expect(evaluateBiologicalDrives).toHaveBeenCalled();
    // Cuando hay un goal crítico (>0.9), debe retornar solo ese
    expect(goals.length).toBe(1);
    expect(goals[0].id).toBe("critical_hunger");
  });

  it("debe evaluar impulsos cognitivos", async () => {
    vi.mocked(evaluateCognitiveDrives).mockReturnValue([
      createTestGoal({ id: "work_drive", type: GoalType.WORK, priority: 0.6 }),
    ]);

    const deps = baseDeps();
    const goals = await planGoals(deps as any, aiState, Date.now(), 0.3);

    expect(evaluateCognitiveDrives).toHaveBeenCalled();
    expect(goals.some((goal) => goal.id === "work_drive")).toBe(true);
  });

  it("debe respetar minPriority al filtrar objetivos", async () => {
    vi.mocked(evaluateCognitiveDrives).mockReturnValue([
      createTestGoal({ id: "low_priority", type: GoalType.WORK, priority: 0.2 }),
      createTestGoal({ id: "high_priority", type: GoalType.WORK, priority: 0.8 }),
    ]);

    const deps = baseDeps();
    const goals = await planGoals(deps as any, aiState, Date.now(), 0.5);

    expect(prioritizeGoals).toHaveBeenCalled();
    expect(goals.some((goal) => goal.id === "high_priority")).toBe(true);
    expect(goals.some((goal) => goal.id === "low_priority")).toBe(false);
  });

  it("debe retornar default exploration cuando no hay otros objetivos", async () => {
    vi.mocked(evaluateBiologicalDrives).mockReturnValue([]);
    vi.mocked(evaluateCognitiveDrives).mockReturnValue([]);
    vi.mocked(evaluateDefaultExploration).mockReturnValue([
      createTestGoal({ id: "default", type: GoalType.EXPLORE, priority: 0.6 }),
    ]);

    const deps = baseDeps();
    const goals = await planGoals(deps as any, aiState, Date.now(), 0.3);

    expect(evaluateDefaultExploration).toHaveBeenCalled();
    expect(goals.some((goal) => goal.id === "default")).toBe(true);
  });
});

