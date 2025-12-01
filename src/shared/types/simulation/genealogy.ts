import { AgentTraits } from "./agents";

export interface Lineage {
  id: string;
  surname: string;
  founder: string;
  foundedAt: number;
  members: string[];
  livingMembers: string[];
  generation: number;
  averageTraits: AgentTraits;
  totalBorn: number;
  totalDied: number;
  favor: number;
  achievements: string[];
  knownRecipes: string[];
  researchProgress: Map<string, number>;
  specializations: string[];
  culturalBonus: number;
  knowledgeLevel: number;
}

export interface Ancestor {
  id: string;
  name: string;
  generation: number;
  birthTimestamp: number;
  deathTimestamp?: number;
  parents?: {
    father?: string;
    mother?: string;
  };
  children: string[];
  traits: AgentTraits;
  lineageId: string;
}

export interface FamilyTree {
  lineages: Map<string, Lineage>;
  ancestors: Map<string, Ancestor>;
  relationships: Map<string, string[]>;
}

export interface GenealogyEventDetails {
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  children?: string[];
  reason?: string;
  cause?: string;
  location?: string;
  age?: number;
  [key: string]: string | number | string[] | undefined;
}

export interface GenealogyEvent {
  type: "birth" | "death" | "marriage" | "divorce" | "adoption";
  timestamp: number;
  agentId: string;
  lineageId?: string;
  details?: GenealogyEventDetails;
}

export interface TraitInheritance {
  father: AgentTraits;
  mother: AgentTraits;
  mutation?: number;
}

export interface LineageStats {
  lineageId: string;
  surname: string;
  population: number;
  avgAge: number;
  avgCooperation: number;
  avgDiligence: number;
  avgCuriosity: number;
  avgAggression: number;
  favor: number;
}

export interface SerializedFamilyTree {
  ancestors: Ancestor[];
  lineages: Array<
    Omit<Lineage, "researchProgress"> & {
      researchProgress: Record<string, number>;
    }
  >;
  relationships: Record<string, string[]>;
}
