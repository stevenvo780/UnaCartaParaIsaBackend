import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { evaluateQuestGoals } from "../../../src/domain/simulation/systems/ai/QuestEvaluator";
import type { AIState } from "../../../src/domain/types/simulation/ai";
import type { Quest } from "../../../src/domain/types/simulation/quests";

describe("QuestEvaluator", () => {
  let aiState: AIState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debe generar goals para quests activos según tipo de objetivo", () => {
    const quest: Quest = {
      id: "quest-1",
      title: "Recolectar recursos",
      description: "Ayuda al pueblo",
      status: "active",
      objectives: [
        {
          id: "obj-1",
          description: "Recolectar madera",
          type: "collect_resource",
          isCompleted: false,
        },
      ],
      rewards: [],
      requirements: [],
      dialogues: [],
    };

    const goals = evaluateQuestGoals(
      {
        getActiveQuests: () => [quest],
        getAvailableQuests: () => [],
        getEntityPosition: () => ({ x: 0, y: 0 }),
      },
      aiState,
    );

    expect(goals).toHaveLength(1);
    expect(goals[0].type).toBe("gather");
    expect(goals[0].priority).toBe(0.6);
    expect(goals[0].data).toEqual({
      questId: "quest-1",
      objectiveId: "obj-1",
    });
  });

  it("debe ignorar objetivos completados", () => {
    const quest: Quest = {
      id: "quest-1",
      title: "Recolectar recursos",
      description: "Ayuda al pueblo",
      status: "active",
      objectives: [
        {
          id: "obj-1",
          description: "Completado",
          type: "collect_resource",
          isCompleted: true,
        },
      ],
      rewards: [],
      requirements: [],
      dialogues: [],
    };

    const goals = evaluateQuestGoals(
      {
        getActiveQuests: () => [quest],
        getAvailableQuests: () => [],
        getEntityPosition: () => ({ x: 0, y: 0 }),
      },
      aiState,
    );

    expect(goals).toHaveLength(0);
  });

  it("debe crear goal para iniciar quest cuando no hay quests activos", () => {
    const availableQuest: Quest = {
      id: "quest-available",
      title: "Nueva aventura",
      description: "Explora el mundo",
      status: "available",
      objectives: [],
      rewards: [],
      requirements: [],
      dialogues: [],
    };

    const goals = evaluateQuestGoals(
      {
        getActiveQuests: () => [],
        getAvailableQuests: () => [availableQuest],
        getEntityPosition: () => ({ x: 0, y: 0 }),
      },
      aiState,
    );

    expect(goals).toHaveLength(1);
    expect(goals[0].type).toBe("social");
    expect(goals[0].data).toEqual({
      questId: "quest-available",
      action: "start_quest",
    });
  });
});

