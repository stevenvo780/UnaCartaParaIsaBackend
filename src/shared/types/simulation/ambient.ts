import { NeedType } from "../../constants/AIEnums";

export interface NeedDesireSnapshot {
  agentId: string;
  needType: NeedType;
  intensity: number;
  zoneId?: string;
  position?: { x: number; y: number };
  timestamp: number;
}

export interface ResourceBiasSnapshot {
  resourceType: string;
  intensity: number;
}

export interface ResourceAttractionFieldSnapshot {
  zoneId: string;
  totalDesire: number;
  spawnBias: number;
  lastSpawn: number;
  dominantNeeds: ResourceBiasSnapshot[];
}

export interface ResourceEmergencyRequest {
  agentId: string;
  resourceType: string;
  urgency: number;
  zoneId?: string;
  timestamp: number;
}

export interface ResourceAttractionStats {
  totalDesires: number;
  activeZones: number;
  attractedSpawns: number;
  emergencyRequests: number;
}

export interface ResourceAttractionSnapshot {
  updatedAt: number;
  desires: NeedDesireSnapshot[];
  fields: ResourceAttractionFieldSnapshot[];
  stats: ResourceAttractionStats;
  emergencies: ResourceEmergencyRequest[];
}

import {
  CrisisSeverity,
  CrisisTrend,
  CrisisPredictionType,
  AmbientMood,
  DialoguePriority,
  DialogueTone,
  DialogueCardType,
  DialogueOutcome,
  WeatherType,
} from "../../constants/AmbientEnums";
export {
  CrisisSeverity,
  CrisisTrend,
  CrisisPredictionType,
  AmbientMood,
  DialoguePriority,
  DialogueTone,
  DialogueCardType,
  DialogueOutcome,
  WeatherType,
};

export interface CrisisIndicator {
  name: string;
  value: number;
  threshold: number;
  severity: CrisisSeverity;
  trend: CrisisTrend;
  description: string;
}

export interface CrisisPrediction {
  id: string;
  type: CrisisPredictionType;
  probability: number;
  timeToImpact: number;
  severity: number;
  indicators: string[];
  recommendedActions: string[];
  timestamp: number;
}

export interface CrisisSnapshot {
  indicators: CrisisIndicator[];
  predictions: CrisisPrediction[];
  historySize: number;
  lastUpdated: number;
}

export interface CollectiveWellbeing {
  average: number;
  variance: number;
  trend: CrisisTrend;
  criticalCount: number;
  totalAgents: number;
  mood: AmbientMood;
}

export interface AmbientState {
  musicMood: string;
  lightingTint: number;
  particleIntensity: number;
  worldPulseRate: number;
  weatherBias: WeatherType;
}

export interface AmbientSnapshot {
  wellbeing: CollectiveWellbeing;
  ambientState: AmbientState;
  lastUpdated: number;
}

export interface DialogueChoice {
  id: string;
  text: string;
  outcome: DialogueOutcome;
  effects: {
    needs?: Partial<Record<string, number>>;
    relationship?: number;
    unlocksMission?: string;
    moveTo?: string;
  };
}

export interface DialogueCard {
  id: string;
  title: string;
  content: string;
  type: DialogueCardType;
  priority: DialoguePriority;
  participants: string[];
  triggerCondition?: string;
  choices?: DialogueChoice[];
  emotionalTone: DialogueTone;
  duration: number;
  consequences?: Record<string, unknown>;
  timestamp: number;
}

export interface DialogueStateSnapshot {
  active: DialogueCard[];
  history: DialogueCard[];
  queueSize: number;
  lastGeneratedAt: number;
}
