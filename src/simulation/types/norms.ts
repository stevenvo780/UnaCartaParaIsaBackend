export interface NormViolation {
  id: string;
  timestamp: number;
  attackerId: string;
  targetId: string;
  zoneId: string;
  zoneType: string;
  sanctionApplied: boolean;
  reputationPenalty: number;
  guardDispatched: boolean;
}

export interface SanctionRecord {
  timestamp: number;
  agentId: string;
  violationType: string;
  reputationPenalty: number;
  trustPenalty: number;
  truceDuration: number;
}

export interface GuardDispatch {
  timestamp: number;
  guardId: string;
  targetLocation: { x: number; y: number };
  zoneId: string;
  distance: number;
  resolved: boolean;
}

export interface NormComplianceStats {
  totalViolations: number;
  protectedZonesCount: number;
  totalSanctions: number;
  totalGuardDispatches: number;
  avgViolationsPerDay: number;
  mostViolatedZone: string | null;
}
