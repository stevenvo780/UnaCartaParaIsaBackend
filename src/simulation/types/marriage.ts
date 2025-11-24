export interface MarriageGroup {
  id: string;
  members: string[];
  foundedDate: number;
  cohesion: number;
  sharedResources: boolean;
  children: string[];
}

export interface MarriageProposal {
  proposerId: string;
  targetGroupId?: string;
  timestamp: number;
}

export interface MarriageEvent {
  timestamp: number;
  type: "formed" | "joined" | "dissolved" | "rejected" | "widowed";
  agentId: string;
  groupId?: string;
  partnerId?: string;
  reason?: string;
}

export interface MarriageConfig {
  maxGroupSize: number;
  baseDifficultyPerMember: number;
  divorceChanceBase: number;
  cohesionDecayPerMember: number;
}

export interface MarriageStats {
  totalMarriages: number;
  totalMembers: number;
  avgGroupSize: number;
  avgCohesion: number;
  largestGroup: number;
  activeProposals: number;
}
