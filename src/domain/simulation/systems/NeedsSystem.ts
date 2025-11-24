import { GameState } from "../../types/game-types";
import { NeedsConfig, EntityNeedsData, NeedsState } from "../../types/simulation/needs";
import { LifeCycleSystem } from "./LifeCycleSystem";

export class NeedsSystem {
  private gameState: GameState;
  private entityNeeds = new Map<string, EntityNeedsData>();
  private config: NeedsConfig;
  private lifeCycleSystem?: LifeCycleSystem;

  constructor(gameState: GameState, lifeCycleSystem?: LifeCycleSystem) {
    this.gameState = gameState;
    this.lifeCycleSystem = lifeCycleSystem;
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

    needs.hunger = Math.max(0, needs.hunger - this.config.hungerDecayRate * dtSec);
    needs.thirst = Math.max(0, needs.thirst - this.config.thirstDecayRate * dtSec);
    needs.energy = Math.max(0, needs.energy - this.config.energyDecayRate * dtSec);
    needs.mentalHealth = Math.max(0, needs.mentalHealth - this.config.mentalHealthDecayRate * dtSec);
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

  public satisfyNeed(entityId: string, needType: string, amount: number): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needs = data.needs;
    const needKey = needType as keyof typeof needs;
    if (needKey in needs && typeof needs[needKey] === 'number') {
      (needs[needKey] as number) = Math.min(100, (needs[needKey] as number) + amount);
      return true;
    }
    return false;
  }

  public modifyNeed(entityId: string, needType: string, delta: number): boolean {
    const data = this.entityNeeds.get(entityId);
    if (!data) return false;

    const needs = data.needs;
    const needKey = needType as keyof typeof needs;
    if (needKey in needs && typeof needs[needKey] === 'number') {
      (needs[needKey] as number) = Math.max(0, Math.min(100, (needs[needKey] as number) + delta));
      return true;
    }
    return false;
  }

  public updateConfig(newConfig: Partial<NeedsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
