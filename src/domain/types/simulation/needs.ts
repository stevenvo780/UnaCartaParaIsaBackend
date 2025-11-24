export interface EntityNeedsData {
  hunger: number;
  thirst: number;
  energy: number;
  hygiene: number;
  social: number;
  fun: number;
  mentalHealth: number;
  [key: string]: number | undefined; // Allow for dynamic access
}

export interface NeedsConfig {
  decayRates: {
    hunger: number;
    thirst: number;
    energy: number;
    hygiene: number;
    social: number;
    fun: number;
    mentalHealth: number;
  };
  criticalThreshold: number;
  emergencyThreshold: number;
  updateIntervalMs: number;
  allowRespawn: boolean;
  deathThresholds: {
    hunger: number;
    thirst: number;
    energy: number;
  };
  zoneBonusMultiplier: number;
  crossEffectsEnabled: boolean;
}
