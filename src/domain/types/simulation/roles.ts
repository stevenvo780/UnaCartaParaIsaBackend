import { RoleType, WorkShift } from "../../../shared/constants/RoleEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";

// Re-export for backward compatibility
export { RoleType, WorkShift };

export interface RoleRequirements {
  minAge?: number;
  traits?: {
    cooperation?: number;
    diligence?: number;
    curiosity?: number;
    neuroticism?: number;
  };
  forbiddenFor?: string[];
}

export interface RoleConfig {
  type: RoleType;
  name: string;
  description: string;
  primaryResource?: ResourceType;
  requirements: RoleRequirements;
  efficiency: {
    base: number;
    traitBonus: {
      cooperation?: number;
      diligence?: number;
      curiosity?: number;
      neuroticism?: number;
    };
  };
  preferredZoneType: ZoneType;
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
