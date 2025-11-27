export type Sex = "male" | "female";
export type LifeStage = "child" | "adult" | "elder";

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
  socialStatus?: "noble" | "commoner" | "warrior";
  parents?: {
    father?: string;
    mother?: string;
  };
  position?: { x: number; y: number };
  stats?: {
    money?: number;
    reputation?: number;
    [key: string]: string | number | boolean | undefined;
  };
}
