// Re-export enums from AgentEnums for backward compatibility
import { Sex, LifeStage, SocialStatus } from "../../constants/AgentEnums";
export { Sex, LifeStage, SocialStatus };

export interface AgentTraits {
  cooperation: number;
  aggression: number;
  diligence: number;
  curiosity: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  sex: Sex;
  ageYears: number;
  lifeStage: LifeStage;
  birthTimestamp: number;
  generation: number;
  immortal?: boolean;
  traits: AgentTraits;
  socialStatus?: SocialStatus;
  parents?: {
    father?: string;
    mother?: string;
  };
}

export interface SocialGroup {
  id: string;
  members: string[];
  leader?: string;
  cohesion: number;
  morale?: number;
}
