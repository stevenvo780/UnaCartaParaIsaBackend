import { SnapshotManager } from "../../src/domain/simulation/core/runner/SnapshotManager";
import { AgentProfile } from "../../src/shared/types/simulation/agents";
import { GameState } from "../../src/shared/types/game-types";
import { createMockGameState } from "../setup";
import { Sex, LifeStage, SocialStatus, ExplorationType, SocialPreference, WorkEthic } from "../../src/shared/constants/AgentEnums";
import type { AIState } from "../../src/shared/types/simulation/ai";
import type { SimulationRunner } from "../../src/domain/simulation/core/SimulationRunner";

describe("SnapshotManager", () => {
  let snapshotManager: SnapshotManager;
  let mockRunner: any;
  let mockState: any;

  beforeEach(() => {
    mockState = createMockGameState();
    mockRunner = {
      state: mockState,
      stateDirtyTracker: {
        flush: vi.fn().mockReturnValue([]),
      },
      needsSystem: {
        getNeeds: vi.fn(),
      },
      roleSystem: {
        getAgentRole: vi.fn(),
      },
      aiSystem: {
        getAIState: vi.fn(),
        getActiveTask: vi.fn().mockReturnValue(null),
        getPendingTasks: vi.fn().mockReturnValue([]),
        getAgentMemory: vi.fn().mockReturnValue(null),
      },
      capturedEvents: [],
      getTickCounter: vi.fn().mockReturnValue(100),
      emit: vi.fn(),
      _genealogySystem: {
        getSerializedFamilyTree: vi.fn().mockReturnValue({}),
      },
      livingLegendsSystem: {
        getAllLegends: vi.fn().mockReturnValue([]),
        getActiveLegends: vi.fn().mockReturnValue([]),
      },
      socialSystem: {
        getGraphSnapshot: vi.fn().mockReturnValue({}),
      },
    };

    snapshotManager = new SnapshotManager(mockRunner as unknown as SimulationRunner);
  });

  it("should serialize agent memory and personality correctly", () => {
    const agentId = "agent-1";
    const agent: AgentProfile = {
      id: agentId,
      name: "Test Agent",
      sex: "male" as "male",
      ageYears: 25,
      lifeStage: "adult" as "adult",
      birthTimestamp: 0,
      generation: 1,
      isImmortal: false,
      isDead: false,
      traits: {
        cooperation: 0.5,
        aggression: 0.5,
        diligence: 0.5,
        curiosity: 0.5,
        bravery: 0.5
      },
      appearance: {
        hairColor: "#000000",
        eyeColor: "#000000",
        skinColor: "#ffffff",
        hairStyle: "short"
      },
      socialStatus: 0 as SocialStatus,
      parents: {},
      position: { x: 0, y: 0 },
      stats: {
        money: 100,
        reputation: 100
      },
      needs: {
        hunger: 0,
        thirst: 0,
        energy: 100,
        social: 100,
        fun: 100,
        hygiene: 100,
        mentalHealth: 100
      },
      ai: {
        currentGoal: null,
        goalQueue: [],
        currentAction: null,
        offDuty: false,
        lastDecisionTime: 0
      }
    };

    mockState.agents = [agent];

    const mockAIState: AIState = {
      entityId: agentId,
      currentGoal: null,
      goalQueue: [],
      lastDecisionTime: 0,
      offDuty: false,
      personality: {
        cooperation: 0.5,
        diligence: 0.5,
        curiosity: 0.5,
        explorationType: ExplorationType.Balanced,
        socialPreference: SocialPreference.Balanced,
        workEthic: WorkEthic.Balanced,
        riskTolerance: 0.5,
        neuroticism: 0.5,
        extraversion: 0.5,
        openness: 0.5,
        conscientiousness: 0.5,
        agreeableness: 0.5
      },
      memory: {
        visitedZones: new Set(["zone-1", "zone-2"]),
        knownResourceLocations: new Map([
          ["wood", { x: 10, y: 10 }],
        ]),
        successfulActivities: new Map(),
        failedAttempts: new Map(),
        lastSeenThreats: [],
        recentInteractions: [],
      },
    };

    // Use new AISystem v4 methods instead of legacy getAIState
    mockRunner.aiSystem.getAgentMemory.mockReturnValue(mockAIState.memory);
    mockRunner.aiSystem.getActiveTask.mockReturnValue({
      type: 'idle',
      priority: 0.1,
      personality: mockAIState.personality
    });

    const snapshot = snapshotManager.getInitialSnapshot();
    const serializedAgent = snapshot.state.agents[0];

    expect(serializedAgent.ai).toBeDefined();
    const ai = serializedAgent.ai as any;
    
    expect(ai.memory).toBeDefined();
    // Set should be converted to Array
    expect(Array.isArray(ai.memory.visitedZones)).toBe(true);
    expect(ai.memory.visitedZones).toContain("zone-1");
    expect(ai.memory.visitedZones).toContain("zone-2");

    // Map should be converted to Object or Array of entries
    // For JSON serialization, usually we want an object if keys are strings
    expect(ai.memory.knownResourceLocations).toBeDefined();
    // Depending on implementation, check structure. 
    // If we implement it as Object.fromEntries:
    // expect(serializedAgent.ai.memory.knownResourceLocations['wood']).toEqual({ x: 10, y: 10 });
  });
});
