import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../../src/domain/types/game-types";
import type { AIState, AIGoal } from "../../../src/domain/types/simulation/ai";
import {
  calculateNeedPriority,
  selectBestZone,
  prioritizeGoals,
  getGoalTier,
  getRecommendedZoneIdsForNeed,
  getUnexploredZones,
} from "../../../src/domain/simulation/systems/agents/ai/core/utils";
import type {
  PriorityManager,
  GoalDomain,
} from "../../../src/domain/simulation/systems/agents/ai/core/PriorityManager";
import { createMockGameState } from "../../setup";

function createAIState(overrides: Partial<AIState> = {}): AIState {
  return {
    entityId: "agent-1",
    currentGoal: null,
    goalQueue: [],
    lastDecisionTime: Date.now(),
    personality: {
      cooperation: 0.5,
      diligence: 0.5,
      curiosity: 0.5,
      explorationType: "balanced",
      socialPreference: "balanced",
      workEthic: "balanced",
      riskTolerance: 0.5,
      neuroticism: 0.2,
      extraversion: 0.5,
      openness: 0.5,
      conscientiousness: 0.5,
      agreeableness: 0.5,
    },
    memory: {
      lastSeenThreats: [],
      visitedZones: new Set(),
      recentInteractions: [],
      knownResourceLocations: new Map(),
      successfulActivities: new Map(),
      failedAttempts: new Map(),
    },
    offDuty: false,
    ...overrides,
  };
}

function createGoal(
  attrs: Partial<AIGoal> & Pick<AIGoal, "id" | "type" | "priority">,
): AIGoal {
  return {
    targetId: undefined,
    targetPosition: undefined,
    targetZoneId: undefined,
    data: undefined,
    createdAt: Date.now(),
    ...attrs,
  };
}

describe("AI utils", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "food-zone",
          type: "food",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          metadata: { attractiveness: 5 },
        },
        {
          id: "water-zone",
          type: "water",
          bounds: { x: 500, y: 0, width: 100, height: 100 },
          metadata: { attractiveness: 2 },
        },
        {
          id: "rest-zone",
          type: "rest",
          bounds: { x: 1000, y: 0, width: 100, height: 100 },
          metadata: { attractiveness: 8, underConstruction: true },
        },
      ],
      agents: [
        {
          id: "agent-1",
          name: "Test",
          position: { x: 10, y: 10 },
        },
      ],
      entities: [
        {
          id: "entity-1",
          type: "building",
          x: 0,
          y: 0,
          position: { x: 50, y: 50 },
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calculateNeedPriority respeta límites", () => {
    expect(calculateNeedPriority(100, 50)).toBe(0);
    expect(calculateNeedPriority(0, 100)).toBe(1);
    expect(calculateNeedPriority(80, 50)).toBeCloseTo(0.1);
  });

  it("selectBestZone retorna la zona con mejor score", () => {
    const aiState = createAIState();
    const zone = selectBestZone(
      aiState,
      ["food-zone", "rest-zone"],
      "food",
      gameState,
      () => ({ x: 0, y: 0 }),
    );
    expect(zone).toBe("rest-zone");
  });

  it("selectBestZone puede usar rama aleatoria entre las top 3", () => {
    const aiState = createAIState();
    aiState.memory.visitedZones.add("food-zone");
    aiState.memory.visitedZones.add("water-zone");
    aiState.memory.visitedZones.add("rest-zone");

    const randomSpy = vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const zone = selectBestZone(
      aiState,
      ["food-zone", "water-zone", "rest-zone"],
      "explore",
      gameState,
      () => ({ x: 10, y: 10 }),
    );

    expect(randomSpy).toHaveBeenCalled();
    expect(["food-zone", "water-zone", "rest-zone"]).toContain(zone);
  });

  it("selectBestZone retorna null cuando no hay zonas válidas", () => {
    const aiState = createAIState();
    const zone = selectBestZone(
      aiState,
      ["missing-zone"],
      "food",
      gameState,
      () => null,
    );
    expect(zone).toBeNull();
  });

  it("prioritizeGoals ordena según prioridad final y aplica ruido opcional", () => {
    const goals = [
      createGoal({ id: "g1", type: "work", priority: 0.4 }),
      createGoal({
        id: "g2",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "hunger" },
      }),
    ];

    const aiState = createAIState();

    const priorityManager: PriorityManager = {
      adjust: vi.fn((_agentId, domain: GoalDomain, base: number) => {
        return domain === "survival" ? base + 1 : base;
      }),
    } as PriorityManager;

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const ordered = prioritizeGoals(goals, aiState, priorityManager, 0.1, 0.2);

    expect(randomSpy).toHaveBeenCalled();
    expect(ordered[0].id).toBe("g2");
    expect(priorityManager.adjust).toHaveBeenCalledWith(
      "agent-1",
      "survival",
      expect.any(Number),
    );
  });

  it("getGoalTier asigna niveles para necesidades críticas y logística", () => {
    expect(
      getGoalTier(
        createGoal({
          id: "g1",
          type: "satisfy_need",
          priority: 0.9,
          data: { need: "hunger" },
        }),
        createAIState(),
      ),
    ).toBeGreaterThan(8);

    expect(
      getGoalTier(
        createGoal({
          id: "deposit_wood_job",
          type: "work",
          priority: 0.5,
        }),
        createAIState(),
      ),
    ).toBeGreaterThanOrEqual(6);
  });

  it("getRecommendedZoneIdsForNeed filtra por tipo de necesidad", () => {
    const zones = getRecommendedZoneIdsForNeed("hunger", gameState);
    expect(zones).toContain("food-zone");
    expect(zones).not.toContain("rest-zone");
  });

  it("getUnexploredZones retorna solo zonas no visitadas", () => {
    const aiState = createAIState();
    aiState.memory.visitedZones.add("food-zone");
    const unexplored = getUnexploredZones(aiState, gameState);

    expect(unexplored).toContain("water-zone");
    expect(unexplored).not.toContain("food-zone");
  });
});
