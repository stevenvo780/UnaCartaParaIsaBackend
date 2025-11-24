export interface NeedsState {
  hunger: number;
  thirst: number;
  energy: number;
  hygiene: number;
  social: number;
  fun: number;
  mentalHealth: number;
  lastUpdate: number;
}

export interface EntityNeedsData {
  entityId: string;
  needs: NeedsState;
  currentZone?: string;
  satisfactionSources: Record<string, number>;
  emergencyLevel: "none" | "warning" | "critical" | "dying";
  isDead?: boolean;
  deathTime?: number;
}

export interface NeedsConfig {
  hungerDecayRate: number;
  thirstDecayRate: number;
  energyDecayRate: number;
  mentalHealthDecayRate: number;
  criticalThreshold: number;
  warningThreshold: number;
  recoveryMultiplier: number;
}
