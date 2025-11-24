export type RoleType =
  | "logger"
  | "quarryman"
  | "builder"
  | "farmer"
  | "gatherer"
  | "guard"
  | "idle";

export type WorkShift = "morning" | "afternoon" | "evening" | "night" | "rest";

export interface RoleRequirements {
  minAge?: number;
  traits?: {
    cooperation?: number;
    diligence?: number;
    curiosity?: number;
  };
  forbiddenFor?: string[];
}

export interface RoleConfig {
  type: RoleType;
  name: string;
  description: string;
  primaryResource?: "wood" | "stone" | "food" | "water";
  requirements: RoleRequirements;
  efficiency: {
    base: number;
    traitBonus: {
      cooperation?: number;
      diligence?: number;
      curiosity?: number;
    };
  };
  preferredZoneType: "work" | "food" | "water" | "rest";
  workShifts: WorkShift[];
}

export interface AgentRole {
  agentId: string;
  roleType: RoleType;
  assignedAt: number;
  currentShift: WorkShift;
  efficiency: number;
  experience: number;
  satisfaction: number;
}

export interface ShiftSchedule {
  morning: string[];
  afternoon: string[];
  evening: string[];
  night: string[];
  rest: string[];
}

export interface RoleAssignment {
  success: boolean;
  agentId: string;
  roleType?: RoleType;
  reason?: string;
}

export interface RoleSystemConfig {
  autoAssignRoles: boolean;
  reassignmentIntervalSec: number;
  experienceGainPerSecond: number;
  satisfactionDecayPerSecond: number;
}
