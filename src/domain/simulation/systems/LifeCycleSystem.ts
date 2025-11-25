import { logger } from "../../../infrastructure/utils/logger";
import { EventEmitter } from "events";
import { GameState } from "../../types/game-types";
import {
  AgentProfile,
  AgentTraits,
  LifeStage,
} from "../../types/simulation/agents";
import { simulationEvents, GameEventNames } from "../core/events";
import type { NeedsSystem } from "./NeedsSystem";
import type { AISystem } from "./AISystem";
import type { InventorySystem } from "./InventorySystem";
import type { SocialSystem } from "./SocialSystem";
import type { MarriageSystem } from "./MarriageSystem";
import type { GenealogySystem } from "./GenealogySystem";
import type { HouseholdSystem } from "./HouseholdSystem";
import type { DivineFavorSystem } from "./DivineFavorSystem";
import type { MovementSystem } from "./MovementSystem";

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

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class LifeCycleSystem extends EventEmitter {
  private gameState: GameState;
  private config: LifeCycleConfig;
  private lastResourceConsumption: number = 0;

  private reproductionCooldown = new Map<string, number>();
  private spawnCounter = 0;
  private pendingHousingAssignments = new Set<string>();

  private needsSystem?: NeedsSystem;
  private _aiSystem?: AISystem;
  private inventorySystem?: InventorySystem;
  private householdSystem?: HouseholdSystem;
  private _socialSystem?: SocialSystem;
  private _marriageSystem?: MarriageSystem;
  private _genealogySystem?: GenealogySystem;
  private _divineFavorSystem?: DivineFavorSystem;
  private _movementSystem?: MovementSystem;
  private dependenciesChecked = false;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    super();
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
    };
  }

  public setDependencies(systems: {
    needsSystem?: NeedsSystem;
    aiSystem?: AISystem;
    inventorySystem?: InventorySystem;
    socialSystem?: SocialSystem;
    marriageSystem?: MarriageSystem;
    genealogySystem?: GenealogySystem;
    householdSystem?: HouseholdSystem;
    divineFavorSystem?: DivineFavorSystem;
    movementSystem?: MovementSystem;
  }): void {
    if (systems.needsSystem) this.needsSystem = systems.needsSystem;
    if (systems.aiSystem) this._aiSystem = systems.aiSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this._socialSystem = systems.socialSystem;
    if (systems.marriageSystem) this._marriageSystem = systems.marriageSystem;
    if (systems.genealogySystem)
      this._genealogySystem = systems.genealogySystem;
    if (systems.householdSystem) this.householdSystem = systems.householdSystem;
    if (systems.divineFavorSystem)
      this._divineFavorSystem = systems.divineFavorSystem;
    if (systems.movementSystem) this._movementSystem = systems.movementSystem;
  }

  private checkDependencies(): void {
    if (this.dependenciesChecked) {
      return;
    }
    const missing: string[] = [];
    if (!this.needsSystem) missing.push("NeedsSystem");
    if (!this._aiSystem) missing.push("AISystem");
    if (!this.inventorySystem) missing.push("InventorySystem");
    if (!this.householdSystem) missing.push("HouseholdSystem");
    if (!this._socialSystem) missing.push("SocialSystem");
    if (!this._marriageSystem) missing.push("MarriageSystem");
    if (!this._genealogySystem) missing.push("GenealogySystem");
    if (!this._divineFavorSystem) missing.push("DivineFavorSystem");
    if (!this._movementSystem) missing.push("MovementSystem");
    if (missing.length > 0) {
      logger.warn(
        `LifeCycleSystem: missing dependencies -> ${missing.join(", ")}`,
      );
    }
    this.dependenciesChecked = true;
  }

  public update(deltaTimeMs: number): void {
    if (!this.dependenciesChecked) {
      this.checkDependencies();
    }
    const dtSec = deltaTimeMs / 1000;

    this.lastResourceConsumption += deltaTimeMs;
    if (this.lastResourceConsumption >= 60000) {
      this.consumeResourcesPeriodically();
      this.lastResourceConsumption = 0;
    }

    const yearInc = dtSec / this.config.secondsPerYear;
    const agents = this.gameState.agents || [];

    for (const agent of agents) {
      if (agent.immortal) {
        if (agent.lifeStage === "adult") {
          this.queueHousingAssignment(agent.id);
        }
        continue;
      }

      agent.ageYears += yearInc;
      const previousStage = agent.lifeStage;
      agent.lifeStage = this.getLifeStage(agent.ageYears);

      if (previousStage !== agent.lifeStage) {
        simulationEvents.emit(GameEventNames.AGENT_AGED, {
          entityId: agent.id,
          newAge: agent.ageYears,
          previousStage,
          currentStage: agent.lifeStage,
        });
      }

      if (agent.ageYears > this.config.maxAge) {
        this.removeAgent(agent.id);
      }

      if (agent.lifeStage === "adult") {
        this.queueHousingAssignment(agent.id);
      }
    }

    this.tryBreeding(Date.now());
    this.processHousingAssignments();
  }

  private getLifeStage(age: number): LifeStage {
    if (age < this.config.adultAge) return "child";
    if (age < this.config.elderAge) return "adult";
    return "elder";
  }

  private queueHousingAssignment(agentId: string): void {
    if (this.householdSystem?.getHouseFor(agentId)) return;
    this.pendingHousingAssignments.add(agentId);
  }

  private processHousingAssignments(): void {
    if (!this.householdSystem) return;

    let processed = 0;
    for (const agentId of this.pendingHousingAssignments) {
      if (processed >= 3) break;

      const agent = this.gameState.agents?.find((a) => a.id === agentId);
      if (agent && agent.lifeStage === "adult") {
        const houseId = this.householdSystem.assignToHouse(agentId);
        if (houseId) {
          this.pendingHousingAssignments.delete(agentId);
        }
      } else {
        this.pendingHousingAssignments.delete(agentId);
      }
      processed++;
    }
  }

  private consumeResourcesPeriodically(): void {
    if (!this.inventorySystem) return;

    const agents = this.gameState.agents || [];
    for (const agent of agents) {
      const needs = { food: 1, water: 1 };
      this.inventorySystem.consumeFromAgent(agent.id, needs);
    }
  }

  private async tryBreeding(now: number): Promise<void> {
    const agents = this.gameState.agents || [];
    if (agents.length >= this.config.maxPopulation) return;

    const adults = agents.filter((a) => a.lifeStage === "adult");
    const males = adults.filter((a) => a.sex === "male");
    const females = adults.filter((a) => a.sex === "female");

    if (males.length === 0 || females.length === 0) return;

    if (Math.random() < 0.05) {
      const father = males[Math.floor(Math.random() * males.length)];
      const mother = females[Math.floor(Math.random() * females.length)];

      await this.tryCouple(father.id, mother.id, now);
    }
  }

  private async tryCouple(
    fatherId: string,
    motherId: string,
    now: number,
  ): Promise<void> {
    const pairKey = [fatherId, motherId].sort().join("::");
    const cooldown = this.reproductionCooldown.get(pairKey) || 0;

    if (now < cooldown) return;

    const father = this.gameState.agents?.find((a) => a.id === fatherId);
    const mother = this.gameState.agents?.find((a) => a.id === motherId);

    if (!father || !mother) return;

    const childId = await this.spawnAgent({
      generation: Math.max(father.generation, mother.generation) + 1,
      parents: { father: fatherId, mother: motherId },
      sex: Math.random() > 0.5 ? "male" : "female",
    });

    this.reproductionCooldown.set(
      pairKey,
      now + this.config.reproductionCooldownSec * 1000,
    );

    simulationEvents.emit(GameEventNames.REPRODUCTION_SUCCESS, {
      childId,
      parent1: fatherId,
      parent2: motherId,
    });
  }

  public spawnAgent(partial: Partial<AgentProfile> = {}): AgentProfile {
    const id = `agent_${++this.spawnCounter}`;

    let traits = this.randomTraits();
    if (partial.parents?.father && partial.parents?.mother) {
      traits = this.inheritTraits(
        partial.parents.father,
        partial.parents.mother,
      );
    }

    const profile: AgentProfile = {
      id,
      name: partial.name || `Agent ${id}`,
      sex: partial.sex || "female",
      ageYears: 0,
      lifeStage: "child",
      generation: partial.generation || 0,
      birthTimestamp: Date.now(),
      immortal: false,
      traits,
      socialStatus: "commoner",
      ...partial,
    };

    const world = this.gameState.worldSize ?? { width: 2000, height: 2000 };
    if (!profile.position) {
      profile.position = {
        x: Math.floor(world.width / 2 + (Math.random() - 0.5) * 200),
        y: Math.floor(world.height / 2 + (Math.random() - 0.5) * 200),
      };
    }

    if (!this.gameState.agents) this.gameState.agents = [];
    this.gameState.agents.push(profile);

    if (this.needsSystem) {
      this.needsSystem.initializeEntityNeeds(id);
    }
    if (profile.position) {
      this._movementSystem?.initializeEntityMovement(id, profile.position);
    }

    if (this._genealogySystem) {
      this._genealogySystem.registerBirth(
        profile,
        profile.parents?.father,
        profile.parents?.mother,
      );
    }

    simulationEvents.emit(GameEventNames.AGENT_BIRTH, {
      entityId: id,
      parentIds: profile.parents
        ? [profile.parents.father, profile.parents.mother]
        : undefined,
    });

    return profile;
  }

  private randomTraits(): AgentTraits {
    return {
      cooperation: Math.random(),
      diligence: Math.random(),
      curiosity: Math.random(),
      aggression: Math.random(),
    };
  }

  private inheritTraits(fatherId: string, motherId: string): AgentTraits {
    const father = this.getAgent(fatherId);
    const mother = this.getAgent(motherId);

    if (!father || !mother) return this.randomTraits();

    const mix = (a: number, b: number): number => {
      const base = (a + b) / 2;
      const mutation = (Math.random() - 0.5) * 0.2;
      return Math.max(0, Math.min(1, base + mutation));
    };

    return {
      cooperation: mix(father.traits.cooperation, mother.traits.cooperation),
      aggression: mix(father.traits.aggression, mother.traits.aggression),
      diligence: mix(father.traits.diligence, mother.traits.diligence),
      curiosity: mix(father.traits.curiosity, mother.traits.curiosity),
    };
  }

  public getAgent(id: string): AgentProfile | undefined {
    return this.gameState.agents?.find((a) => a.id === id);
  }

  public getAgents(): AgentProfile[] {
    return this.gameState.agents || [];
  }

  public removeAgent(id: string): void {
    if (!this.gameState.agents) return;

    const index = this.gameState.agents.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.gameState.agents.splice(index, 1);
      simulationEvents.emit(GameEventNames.ANIMAL_DIED, { entityId: id });
    }
  }

  public killAgent(id: string): boolean {
    if (!this.gameState.agents) return false;
    const index = this.gameState.agents.findIndex((a) => a.id === id);
    if (index === -1) return false;

    this.gameState.agents.splice(index, 1);

    simulationEvents.emit(GameEventNames.AGENT_DEATH, {
      entityId: id,
      reason: "killed",
    });

    return true;
  }
}
