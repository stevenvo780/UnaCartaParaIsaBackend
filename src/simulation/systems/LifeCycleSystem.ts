import { GameState } from "../../types/game-types.js";
import { AgentProfile, LifeStage, AgentTraits } from "../types/agents.js";

interface LifeCycleConfig {
  secondsPerYear: number;
  adultAge: number;
  elderAge: number;
  maxAge: number;
  reproductionCooldownSec: number;
  maxPopulation: number;
  fertilityMinAge: number;
  fertilityMaxAge: number;
  godMaxChildren: number;
  godInterbirthSec: number;
  mortalInterbirthSec: number;
}

export class LifeCycleSystem {
  private gameState: GameState;
  private config: LifeCycleConfig;
  private agents = new Map<string, AgentProfile>();
  private lastUpdate = 0;
  private reproductionCooldown = new Map<string, number>();

  constructor(gameState: GameState, config?: Partial<LifeCycleConfig>) {
    this.gameState = gameState;
    this.config = {
      secondsPerYear: 30,
      adultAge: 16,
      elderAge: 55,
      maxAge: 85,
      reproductionCooldownSec: 90,
      maxPopulation: 50,
      fertilityMinAge: 18,
      fertilityMaxAge: 45,
      godMaxChildren: 6,
      godInterbirthSec: 600,
      mortalInterbirthSec: 240,
      ...config,
    };

    // Initialize agents map from gameState if it has data (stubbed for now)
    // In a real scenario, we'd sync this.
  }

  public update(deltaTimeMs: number): void {
    const now = Date.now();
    const dtSec = deltaTimeMs / 1000;
    const yearInc = dtSec / this.config.secondsPerYear;

    this.agents.forEach((agent) => {
      if (agent.immortal) return;

      agent.ageYears += yearInc;

      const previousStage = agent.lifeStage;
      agent.lifeStage = this.getLifeStage(agent.ageYears);

      if (previousStage !== agent.lifeStage) {
        // Emit event or log
        console.log(`Agent ${agent.id} aged to ${agent.lifeStage}`);
      }

      if (agent.ageYears > this.config.maxAge) {
        this.removeAgent(agent.id);
      }
    });

    // Reproduction logic would go here
  }

  public getAgent(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  public addAgent(agent: AgentProfile): void {
    this.agents.set(agent.id, agent);
    // Also update GameState entities if they are linked
    // this.gameState.entities.push(agent); // Need to align types first
  }

  private removeAgent(id: string): void {
    this.agents.delete(id);
    console.log(`Agent ${id} died of old age`);
    // Remove from GameState
  }

  private getLifeStage(age: number): LifeStage {
    if (age < this.config.adultAge) return "child";
    if (age < this.config.elderAge) return "adult";
    return "elder";
  }
}
