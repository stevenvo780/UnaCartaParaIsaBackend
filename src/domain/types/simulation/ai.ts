export type GoalType =
  | "satisfy_need"
  | "satisfy_hunger"
  | "satisfy_thirst"
  | "satisfy_energy"
  | "satisfy_social"
  | "satisfy_fun"
  | "work"
  | "explore"
  | "social"
  | "combat"
  | "craft"
  | "deposit"
  | "assist"
  | "construction"
  | "gather"
  | "idle";

export type ActionType =
  | "move"
  | "harvest"
  | "eat"
  | "drink"
  | "sleep"
  | "work"
  | "socialize"
  | "attack"
  | "craft"
  | "deposit"
  | "build";

export interface AIGoal {
  type: GoalType;
  priority: number;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  data?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
}

export interface AIState {
  entityId: string;
  currentGoal: AIGoal | null;
  goalQueue: AIGoal[];
  lastDecisionTime: number;
  personality: AgentPersonality;
  memory: AgentMemory;
  offDuty: boolean;
  isInCombat?: boolean;
  lastActionTime?: number;
  currentAction?: AgentAction | null;
}

export interface AgentPersonality {
  // Original traits (from LifeCycleSystem)
  cooperation: number;
  diligence: number;
  curiosity: number;
  aggression?: number;
  sociability?: number;

  // Derived personality attributes
  explorationType: "cautious" | "balanced" | "adventurous";
  socialPreference: "introverted" | "balanced" | "extroverted";
  workEthic: "lazy" | "balanced" | "workaholic";
  riskTolerance: number; // 0-1

  // Big Five personality traits
  neuroticism: number; // 0-1
  extraversion: number; // 0-1
  openness: number; // 0-1
  conscientiousness: number; // 0-1
  agreeableness: number; // 0-1
}

export interface AgentMemory {
  lastSeenThreats: Array<{
    entityId: string;
    position: { x: number; y: number };
    timestamp: number;
  }>;
  visitedZones: Set<string>;
  recentInteractions: Array<{
    partnerId: string;
    timestamp: number;
    type: string;
  }>;
  knownResourceLocations: Map<string, { x: number; y: number }>;

  // Zone and activity memory
  homeZoneId?: string;
  successfulActivities?: Map<string, number>; // zoneId -> successCount
  failedAttempts?: Map<string, number>; // zoneId -> failCount

  // Temporal tracking
  lastExplorationTime?: number;
  lastMemoryCleanup?: number;
}

export interface AgentAction {
  actionType: ActionType;
  agentId: string;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  duration?: number;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface AISystemConfig {
  decisionIntervalMs: number;
  goalTimeoutMs: number;
  minPriorityThreshold: number;
  batchSize: number;
}
