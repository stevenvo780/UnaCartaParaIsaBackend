import { NeedsConfig, EntityNeedsData } from "../../types/simulation/needs";

export class NeedsSystem {
  private entityNeeds = new Map<string, EntityNeedsData>();
  private config: NeedsConfig;

  constructor(_gameState: unknown, _lifeCycleSystem?: unknown) {
    // Constructor parameters kept for API compatibility but not used internally
    void _gameState;
    void _lifeCycleSystem;
    this.config = {
      hungerDecayRate: 0.1,
      thirstDecayRate: 0.15,
      energyDecayRate: 0.09,
      mentalHealthDecayRate: 0.08,
      criticalThreshold: 20,
      warningThreshold: 45,
      recoveryMultiplier: 7.0,
    };
  }

  public update(deltaTimeMs: number): void {
    const dtSec = deltaTimeMs / 1000;

    this.entityNeeds.forEach((data) => {
      if (data.isDead) return;
      this.updateEntityNeeds(data, dtSec);
    });
  }

  private updateEntityNeeds(data: EntityNeedsData, dtSec: number): void {
    const { needs } = data;

    // 1. Base Decay
    needs.hunger = Math.max(
      0,
      needs.hunger - this.config.hungerDecayRate * dtSec,
    );
    needs.thirst = Math.max(
      0,
      needs.thirst - this.config.thirstDecayRate * dtSec,
    );
    needs.energy = Math.max(
      0,
      needs.energy - this.config.energyDecayRate * dtSec,
    );
    needs.mentalHealth = Math.max(
      0,
      needs.mentalHealth - this.config.mentalHealthDecayRate * dtSec,
    );

    // 2. Cross Effects (Restored from Frontend)
    this.applyCrossEffects(needs, dtSec);

    // 3. Safety Validation (Restored from Frontend)
    this.applySafetyValidation(needs, dtSec);

    // 4. Update Emergency Level
    this.updateEmergencyLevel(data);
  }

  private updateEmergencyLevel(data: EntityNeedsData): void {
    const { needs } = data;
    const critical = this.config.criticalThreshold;
    const warning = this.config.warningThreshold;

    const isCritical =
      needs.hunger < critical ||
      needs.thirst < critical ||
      needs.energy < critical ||
      needs.mentalHealth < critical;

    if (isCritical) {
      data.emergencyLevel = "critical";
      return;
    }

    const isWarning =
      needs.hunger < warning ||
      needs.thirst < warning ||
      needs.energy < warning ||
      needs.mentalHealth < warning;

    if (isWarning) {
      data.emergencyLevel = "warning";
      return;
    }

    data.emergencyLevel = "none";
  }

  private applyCrossEffects(
    needs: EntityNeedsData["needs"],
    dtSec: number,
  ): void {
    const SAFETY_THRESHOLD = 5;

    if (needs.hunger < 10) {
      needs.energy = Math.max(SAFETY_THRESHOLD, needs.energy - 0.1 * dtSec);
      needs.mentalHealth = Math.max(
        SAFETY_THRESHOLD,
        needs.mentalHealth - 0.05 * dtSec,
      );
    }

    if (needs.thirst < 10) {
      needs.energy = Math.max(SAFETY_THRESHOLD, needs.energy - 0.15 * dtSec);
      needs.mentalHealth = Math.max(
        SAFETY_THRESHOLD,
        needs.mentalHealth - 0.05 * dtSec,
      );
    }

    if (needs.energy < 25) {
      needs.hunger = Math.max(SAFETY_THRESHOLD, needs.hunger - 0.1 * dtSec);
      needs.thirst = Math.max(SAFETY_THRESHOLD, needs.thirst - 0.1 * dtSec);
    }

    if (needs.mentalHealth < 30) {
      needs.hunger = Math.max(SAFETY_THRESHOLD, needs.hunger - 0.05 * dtSec);
      needs.energy = Math.max(SAFETY_THRESHOLD, needs.energy - 0.1 * dtSec);
    }

    if (needs.hygiene < 10) {
      needs.mentalHealth = Math.max(
        SAFETY_THRESHOLD,
        needs.mentalHealth - 0.02 * dtSec,
      );
    }

    if (needs.fun < 5) {
      needs.mentalHealth = Math.max(
        SAFETY_THRESHOLD,
        needs.mentalHealth - 0.03 * dtSec,
      );
    }

    if (needs.social < 5) {
      needs.mentalHealth = Math.max(
        SAFETY_THRESHOLD,
        needs.mentalHealth - 0.04 * dtSec,
      );
    }
  }

  private applySafetyValidation(
    needs: EntityNeedsData["needs"],
    dtSec: number,
  ): void {
    const CRITICAL_MIN = 1;

    // Emergency recovery if time jump or severe lag
    if (dtSec > 5) {
      (Object.keys(needs) as Array<keyof typeof needs>).forEach((key) => {
        const val = needs[key];
        if (typeof val === "number" && key !== "lastUpdate" && val < 5) {
          (needs[key] as number) = Math.min(15, val + 5);
        }
      });
    }

    // Hard clamping
    (Object.keys(needs) as Array<keyof typeof needs>).forEach((key) => {
      if (key === "lastUpdate") return;
      const val = needs[key];
      if (typeof val === "number") {
        if (val < CRITICAL_MIN) (needs[key] as number) = CRITICAL_MIN;
        if (val > 100) (needs[key] as number) = 100;
      }
    });
  }

  public initializeEntityNeeds(entityId: string): void {
    this.entityNeeds.set(entityId, {
      entityId,
      needs: {
        hunger: 100,
        thirst: 100,
        energy: 100,
        hygiene: 100,
        social: 100,
        fun: 100,
        mentalHealth: 100,
        lastUpdate: Date.now(),
      },
      satisfactionSources: {},
      emergencyLevel: "none",
    });
  }

  public getEntityNeeds(entityId: string): EntityNeedsData | undefined {
    return this.entityNeeds.get(entityId);
  }

  public getAllNeeds(): EntityNeedsData[] {
    return Array.from(this.entityNeeds.values());
  }

  public satisfyNeed(
    entityId: string,
    needType: string,
    amount: number,
  ): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needs = data.needs;
    const needKey = needType as keyof typeof needs;
    if (needKey in needs && typeof needs[needKey] === "number") {
      (needs[needKey] as number) = Math.min(
        100,
        (needs[needKey] as number) + amount,
      );
      return true;
    }
    return false;
  }

  public modifyNeed(
    entityId: string,
    needType: string,
    delta: number,
  ): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needs = data.needs;
    const needKey = needType as keyof typeof needs;
    if (needKey in needs && typeof needs[needKey] === "number") {
      (needs[needKey] as number) = Math.max(
        0,
        Math.min(100, (needs[needKey] as number) + delta),
      );
      return true;
    }
    return false;
  }

  public updateConfig(newConfig: Partial<NeedsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
