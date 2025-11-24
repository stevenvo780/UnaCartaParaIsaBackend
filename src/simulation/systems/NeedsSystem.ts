import { GameState } from "../../types/game-types.js";
import { NeedsConfig, EntityNeedsData, NeedsState } from "../types/needs.js";
import { LifeCycleSystem } from "./LifeCycleSystem.js";

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

    // Simple decay for now
    needs.hunger = Math.max(0, needs.hunger - this.config.hungerDecayRate * dtSec);
    needs.thirst = Math.max(0, needs.thirst - this.config.thirstDecayRate * dtSec);
    needs.energy = Math.max(0, needs.energy - this.config.energyDecayRate * dtSec);
    needs.mentalHealth = Math.max(0, needs.mentalHealth - this.config.mentalHealthDecayRate * dtSec);

    // Check death
    if (needs.hunger <= 0 || needs.thirst <= 0) {
      // data.isDead = true; // Uncomment when ready to kill
      // console.log(`Entity ${data.entityId} is starving/dehydrated`);
    }
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
}
