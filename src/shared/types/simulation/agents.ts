export type Sex = "male" | "female";
export type LifeStage = "child" | "adult" | "elder";

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
  socialStatus?: "noble" | "commoner" | "warrior";
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
