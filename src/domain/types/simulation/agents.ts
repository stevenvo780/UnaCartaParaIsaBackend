import {
  Sex,
  LifeStage,
  SocialStatus,
} from "../../../shared/constants/AgentEnums";

/**
 * Re-export enums for backward compatibility.
 */
export { Sex, LifeStage, SocialStatus };

export interface AgentTraits {
  cooperation: number;
  aggression: number;
  diligence: number;
  curiosity: number;
  bravery?: number;
  intelligence?: number;
  charisma?: number;
  stamina?: number;
  neuroticism?: number;
}

export interface AgentAppearance {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
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
  isDead?: boolean;
  traits: AgentTraits;
  appearance?: AgentAppearance;
  socialStatus?: SocialStatus;
  parents?: {
    father?: string;
    mother?: string;
  };
  position?: { x: number; y: number };
  stats?: {
    money?: number;
    reputation?: number;
  };
  needs?: {
    hunger: number;
    thirst: number;
    energy: number;
    social: number;
    fun: number;
    hygiene: number;
    mentalHealth: number;
  };
  ai?: {
    currentGoal: unknown;
    goalQueue: unknown[];
    currentAction: unknown;
    offDuty: boolean;
    lastDecisionTime: number;
  };
}
