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
  | "idle"
  | "rest"
  | "inspect"
  | "flee"
  | "attack"
  | "hunt";

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
  | "build"
  | "idle";

export interface AIGoalData {
  need?: "hunger" | "thirst" | "energy" | "social" | "fun" | "mentalHealth";
  targetAgentId?: string;
  resourceType?: string;
  amount?: number;
  itemType?: string;
  [key: string]: string | number | undefined;
}

export interface AIGoal {
  id: string;
  type: GoalType;
  priority: number;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  data?: AIGoalData;
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
  cooperation: number;
  diligence: number;
  curiosity: number;
  aggression?: number;
  sociability?: number;

  explorationType: "cautious" | "balanced" | "adventurous";
  socialPreference: "introverted" | "balanced" | "extroverted";
  workEthic: "lazy" | "balanced" | "workaholic";
  riskTolerance: number;

  neuroticism: number;
  extraversion: number;
  openness: number;
  conscientiousness: number;
  agreeableness: number;
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

  homeZoneId?: string;
  successfulActivities: Map<string, number>;
  failedAttempts: Map<string, number>;

  lastExplorationTime?: number;
  lastMemoryCleanup?: number;
}

export interface AgentActionData {
  resourceType?: string;
  amount?: number;
  itemId?: string;
  [key: string]: string | number | undefined;
}

export interface AgentAction {
  actionType: ActionType;
  agentId: string;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  duration?: number;
  data?: AgentActionData;
  timestamp: number;
}

export interface AISystemConfig {
  decisionIntervalMs: number;
  goalTimeoutMs: number;
  minPriorityThreshold: number;
  batchSize: number;
}
