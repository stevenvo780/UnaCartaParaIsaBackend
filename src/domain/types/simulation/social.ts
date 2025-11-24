export interface SocialGroup {
  id: string;
  members: string[];
  cohesion: number;
  leader?: string;
  morale?: number;
}

export interface SocialConfig {
  proximityRadius: number;
  reinforcementPerSecond: number;
  decayPerSecond: number;
  groupThreshold: number;
}
