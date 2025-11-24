import { GameState } from "../../types/game-types";
import { AgentProfile, LifeStage, AgentTraits } from "../../types/simulation/agents";
import { simulationEvents, GameEventNames } from "../core/events";

interface SpawnAgentOptions {
  requestId?: string;
  name?: string;
  sex?: AgentProfile["sex"] | "unknown";
  generation?: number;
  immortal?: boolean;
  parents?: {
    father?: string;
    mother?: string;
  };
  traits?: Partial<AgentTraits>;
}

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

    (gameState.agents ?? []).forEach((agent) => {
      if (!agent?.id) return;
      this.agents.set(agent.id, agent as AgentProfile);
    });
    this.syncAgentsToState();
  }

  public update(deltaTimeMs: number): void {
    const dtSec = deltaTimeMs / 1000;
    const yearInc = dtSec / this.config.secondsPerYear;

    this.agents.forEach((agent) => {
      if (agent.immortal) return;

      agent.ageYears += yearInc;

      const previousStage = agent.lifeStage;
      agent.lifeStage = this.getLifeStage(agent.ageYears);

      if (previousStage !== agent.lifeStage) {
        console.log(`Agent ${agent.id} aged to ${agent.lifeStage}`);
      }

      if (agent.ageYears > this.config.maxAge) {
        this.removeAgent(agent.id);
      }
    });
  }

  public getAgent(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  public addAgent(agent: AgentProfile): void {
    this.agents.set(agent.id, agent);
    this.syncAgentsToState();

    // Create corresponding SimulationEntity if it doesn't exist
    const existingEntityIndex = this.gameState.entities.findIndex(e => e.id === agent.id);
    if (existingEntityIndex === -1) {
      this.gameState.entities.push({
        id: agent.id,
        name: agent.name,
        x: 2048 + (Math.random() * 100 - 50),
        y: 2048 + (Math.random() * 100 - 50),
        type: "agent",
        state: "idle",
        stats: {
          health: 100,
          energy: 100,
          happiness: 100
        },
        tags: ["agent", agent.sex]
      });
    }

    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: agent.id,
      action: "birth",
    });
  }

  public getAgents(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  public removeAgent(id: string): void {
    const removed = this.agents.delete(id);
    if (!removed) return;
    console.log(`Agent ${id} removed from lifecycle system`);
    this.syncAgentsToState();

    // Remove corresponding SimulationEntity
    const entityIndex = this.gameState.entities.findIndex(e => e.id === id);
    if (entityIndex !== -1) {
      this.gameState.entities.splice(entityIndex, 1);
    }

    simulationEvents.emit(GameEventNames.COMBAT_KILL, {
      targetId: id,
      agentId: id,
      cause: "lifecycle",
    });
  }

  public spawnAgent(options: SpawnAgentOptions = {}): AgentProfile {
    const id =
      options.requestId ??
      `agent_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
    const traits = this.normalizeTraits(options.traits);
    const agent: AgentProfile = {
      id,
      name: options.name ?? `Agent ${id.slice(-4)}`,
      sex: options.sex === "female" ? "female" : "male",
      ageYears: 18,
      lifeStage: "adult",
      birthTimestamp: Date.now(),
      generation: options.generation ?? 0,
      immortal: options.immortal ?? false,
      traits,
      parents:
        options.parents && (options.parents.father || options.parents.mother)
          ? {
            father: options.parents.father,
            mother: options.parents.mother,
          }
          : undefined,
    };
    this.addAgent(agent);
    return agent;
  }

  public killAgent(agentId: string): boolean {
    if (!this.agents.has(agentId)) {
      return false;
    }
    this.removeAgent(agentId);
    return true;
  }

  private getLifeStage(age: number): LifeStage {
    if (age < this.config.adultAge) return "child";
    if (age < this.config.elderAge) return "adult";
    return "elder";
  }

  private syncAgentsToState(): void {
    this.gameState.agents = Array.from(this.agents.values());
  }

  private normalizeTraits(partial?: Partial<AgentTraits>): AgentTraits {
    return {
      cooperation: partial?.cooperation ?? 0.5,
      aggression: partial?.aggression ?? 0.5,
      diligence: partial?.diligence ?? 0.5,
      curiosity: partial?.curiosity ?? 0.5,
    };
  }
}
