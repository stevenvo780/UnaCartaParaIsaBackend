export interface LegendRecord {
  agentId: string;
  agentName: string;
  reputation: number;
  reputationTrend: "rising" | "falling" | "stable";

  titles: string[];
  currentTitle: string;

  deeds: LegendDeed[];

  actionsCompleted: Map<string, number>;
  relationshipCount: number;

  auraColor: number;
  auraIntensity: number;
  glowRadius: number;

  stories: GeneratedStory[];
  legendTier:
    | "unknown"
    | "known"
    | "respected"
    | "renowned"
    | "legendary"
    | "mythical";

  firstSeen: number;
  lastUpdate: number;
  becameLegendAt?: number;
}

export interface LegendDeed {
  id: string;
  type: "heroic" | "villainous" | "neutral";
  description: string;
  impact: number;
  timestamp: number;
  witnesses: string[];
}

export interface GeneratedStory {
  id: string;
  title: string;
  narrative: string;
  mood: "epic" | "tragic" | "comedic" | "mysterious";
  basedOnDeeds: string[];
  generatedAt: number;
  popularity: number;
}

export interface ReputationEvent {
  agentId: string;
  oldRep: number;
  newRep: number;
  delta: number;
  reason: string;
  timestamp: number;
}
