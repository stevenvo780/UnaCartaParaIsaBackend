export type BlessingType =
  | "fertility_boost"
  | "productivity_boost"
  | "longevity"
  | "social_harmony"
  | "resilience"
  | "wisdom"
  | "prosperity";

import { GodId } from "../../../shared/constants/DivineEnums";

// Re-export GodId enum for backward compatibility
export { GodId };

export interface BlessingTarget {
  lineageIds?: string[];
  agentIds?: string[];
  global?: boolean;
}

export interface Blessing {
  id: string;
  type: BlessingType;
  name: string;
  description: string;
  duration: number;
  magnitude: number;
  appliedAt: number;
  expiresAt?: number;
  target: BlessingTarget;
}

export interface DivinePower {
  godId: GodId;
  power: number;
  regenRate: number;
}

export interface BlessingEffect {
  type: BlessingType;
  multiplier: number;
}

export interface DivineFavorEventDetails {
  blessingId?: string;
  blessingType?: BlessingType;
  favorChange?: number;
  previousFavor?: number;
  newFavor?: number;
  agentId?: string;
  reason?: string;
  miracleType?: string;
  [key: string]: string | number | undefined;
}

export interface DivineFavorEvent {
  timestamp: number;
  type: "blessing_granted" | "favor_increased" | "favor_decreased" | "miracle";
  godId: GodId;
  lineageId?: string;
  details?: DivineFavorEventDetails;
}

export interface DivineFavor {
  lineageId: string;
  favor: number;
  blessings: string[];
  history: DivineFavorEvent[];
}
