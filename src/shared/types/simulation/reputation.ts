export interface TrustEdge {
  value: number;
  lastUpdated: number;
}

export interface ReputationEntry {
  value: number;
  lastUpdated: number;
}

export interface AgentReputation {
  agentId: string;
  agentName: string;
  reputation: number;
  rank: number;
  lastUpdated: number;
}

export interface TrustRelationship {
  sourceId: string;
  targetId: string;
  trust: number;
  lastUpdated: number;
}

export interface ReputationChange {
  timestamp: number;
  agentId: string;
  oldValue: number;
  newValue: number;
  delta: number;
  reason: string;
}

export interface ReputationConfig {
  decay: {
    perSecond: number;
    targetValue: number;
  };
  initialValues: {
    trust: number;
    reputation: number;
  };
  impacts: {
    socialRelation: {
      trust: number;
      reputation: number;
    };
    combat: {
      maxImpact: number;
      damageNormalizer: number;
    };
    interactionGame: {
      scale: number;
      exploitPenalty: number;
    };
  };
  bounds: {
    min: number;
    max: number;
  };
}

export interface SerializedReputationData {
  trust: Array<{
    sourceId: string;
    targets: Array<{ targetId: string; value: number; lastUpdated: number }>;
  }>;
  reputation: Array<{
    agentId: string;
    value: number;
    lastUpdated: number;
  }>;
  reputationHistory: Array<{
    agentId: string;
    changes: ReputationChange[];
  }>;
}
