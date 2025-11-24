export type GoalType =
  | 'satisfy_need'
  | 'work'
  | 'explore'
  | 'social'
  | 'combat'
  | 'craft'
  | 'deposit'
  | 'assist'
  | 'construction';

export type ActionType =
  | 'move'
  | 'harvest'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'work'
  | 'socialize'
  | 'attack'
  | 'craft'
  | 'deposit'
  | 'build';

export interface AIGoal {
  type: GoalType;
  priority: number;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  data?: Record<string, any>;
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
}

export interface AgentPersonality {
  cooperation: number;
  diligence: number;
  curiosity: number;
  aggression?: number;
  sociability?: number;
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
}

export interface AgentAction {
  actionType: ActionType;
  agentId: string;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  duration?: number;
  data?: Record<string, any>;
  timestamp: number;
}

export interface AISystemConfig {
  decisionIntervalMs: number;
  goalTimeoutMs: number;
  minPriorityThreshold: number;
  batchSize: number;
}
