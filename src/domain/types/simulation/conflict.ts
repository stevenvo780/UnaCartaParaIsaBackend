export interface ActiveConflict {
  cardId: string;
  attackerId: string;
  targetId: string;
  startedAt: number;
  expiresAt: number;
}

export interface ConflictRecord {
  timestamp: number;
  attackerId: string;
  targetId: string;
  resolved: boolean;
  resolution: "truce_accepted" | "apologized" | "continued" | "expired";
  cardId: string;
}

export interface MediationAttempt {
  timestamp: number;
  cardId: string;
  attackerId: string;
  targetId: string;
  outcome: "accepted" | "apologized" | "rejected" | "expired";
  reason: "low_health" | "heavy_hit" | "default";
}

export interface ConflictStats {
  totalConflicts: number;
  activeNegotiations: number;
  totalMediations: number;
  mediationSuccessRate: number;
  truceAcceptanceRate: number;
}
