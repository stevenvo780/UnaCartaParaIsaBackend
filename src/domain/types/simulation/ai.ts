import {
  GoalType,
  ActionType,
  NeedType,
} from "../../../shared/constants/AIEnums";
import {
  ExplorationType,
  SocialPreference,
  WorkEthic,
} from "../../../shared/constants/AgentEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

/**
 * Re-export enums for backward compatibility.
 */
export { GoalType, ActionType, NeedType };

export interface AIGoalData {
  need?: NeedType;
  targetAgentId?: string;
  resourceType?: ResourceType;
  amount?: number;
  itemType?: string;
  targetRegionX?: number;
  targetRegionY?: number;
  explorationType?: string;
  roleType?: string;
  questId?: string;
  action?: string;
  taskId?: string;
  workType?: string;
  buildingType?: string;
  communityTask?: boolean;
  collectiveNeed?: string;
  constructionType?: string;
  reason?: string;
  taskType?: string;
  urgency?: number;
  stockpileFillRatio?: number;
  prosperityDrive?: string;
  itemId?: string;
  targetResource?: string;
  settlementNeed?: string;
  targetType?: string;
  objectiveId?: string;
  animalType?: string;
  searchFor?: string;
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

  explorationType: ExplorationType;
  socialPreference: SocialPreference;
  workEthic: WorkEthic;
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
  /** Targets that recently failed - agent won't retry for FAILED_TARGET_COOLDOWN_MS */
  failedTargets?: Map<string, number>;

  lastExplorationTime?: number;
  lastMemoryCleanup?: number;
}

export interface AgentActionData {
  resourceType?: ResourceType;
  amount?: number;
  itemId?: string;
  taskId?: string;
  itemType?: string;
  workType?: string;
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
