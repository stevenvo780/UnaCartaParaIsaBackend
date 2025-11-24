import type { ResourceCost } from "./economy";

export type DemandType =
  | "food_shortage"
  | "water_shortage"
  | "housing_full"
  | "defense_needed"
  | "storage_needed"
  | "infrastructure";

export interface SettlementDemand {
  id: string;
  type: DemandType;
  priority: number;
  detectedAt: number;
  resolvedAt?: number;
  reason: string;
  metrics?: Record<string, number>;
  suggestedProject?: string;
  pendingReservationId?: string;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: Record<string, number>;
  autoResolve: boolean;
}

export interface SettlementStats {
  population: number;
  houses: number;
  housingCapacity: number;
  foodStockpile: number;
  waterStockpile: number;
  avgHappiness: number;
  avgHealth: number;
  workersAvailable: number;
  idleAgents: number;
  foodPerCapita: number;
  waterPerCapita: number;
  housingOccupancy: number;
}

export interface GovernanceEventDetails {
  demandId?: string;
  demandType?: DemandType;
  policyId?: string;
  policyName?: string;
  projectId?: string;
  projectType?: string;
  reason?: string;
  agentId?: string;
  settlementId?: string;
  [key: string]: string | number | undefined;
}

export interface GovernanceEvent {
  timestamp: number;
  type:
    | "demand_created"
    | "demand_resolved"
    | "policy_changed"
    | "project_started"
    | "project_failed";
  details: GovernanceEventDetails;
}

export interface GovernanceSnapshot {
  stats: SettlementStats;
  policies: GovernancePolicy[];
  demands: SettlementDemand[];
  history: GovernanceEvent[];
  reservations: ResourceCost;
}
