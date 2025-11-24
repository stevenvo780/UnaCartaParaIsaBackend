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

export class LifeCycleSystem extends EventEmitter {
  private gameState: GameState;
  private config: LifeCycleConfig;
  private lastUpdate: number = 0;
  private lastResourceConsumption: number = 0;

  // State
  private reproductionCooldown = new Map<string, number>();
  private spawnCounter = 0;
  private pendingHousingAssignments = new Set<string>();

  // Dependencies
  private needsSystem?: NeedsSystem;
  private aiSystem?: AISystem;
  private inventorySystem?: InventorySystem;
  private householdSystem?: HouseholdSystem;
  private socialSystem?: SocialSystem;
  private marriageSystem?: MarriageSystem;
  private genealogySystem?: GenealogySystem;
  private divineFavorSystem?: DivineFavorSystem;

  constructor(
    gameState: GameState,
    config?: Partial<LifeCycleConfig>,
    systems?: {
      needsSystem?: NeedsSystem;
      aiSystem?: AISystem;
      inventorySystem?: InventorySystem;
      socialSystem?: SocialSystem;
      marriageSystem?: MarriageSystem;
      genealogySystem?: GenealogySystem;
      householdSystem?: HouseholdSystem;
      divineFavorSystem?: DivineFavorSystem;
    },
  ) {
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
      ...config,
    };

    if (systems) {
      this.needsSystem = systems.needsSystem;
      this.aiSystem = systems.aiSystem;
      this.inventorySystem = systems.inventorySystem;
      this.socialSystem = systems.socialSystem;
      this.marriageSystem = systems.marriageSystem;
      this.genealogySystem = systems.genealogySystem;
      this.householdSystem = systems.householdSystem;
      this.divineFavorSystem = systems.divineFavorSystem;
    }
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
  }): void {
    if (systems.needsSystem) this.needsSystem = systems.needsSystem;
    if (systems.aiSystem) this.aiSystem = systems.aiSystem;
    if (systems.inventorySystem) this.inventorySystem = systems.inventorySystem;
    if (systems.socialSystem) this.socialSystem = systems.socialSystem;
    if (systems.marriageSystem) this.marriageSystem = systems.marriageSystem;
    if (systems.genealogySystem) this.genealogySystem = systems.genealogySystem;
    if (systems.householdSystem) this.householdSystem = systems.householdSystem;
    if (systems.divineFavorSystem)
      this.divineFavorSystem = systems.divineFavorSystem;
  }

  private checkDependencies(): void {
    if (!this.needsSystem) logger.warn("LifeCycleSystem: NeedsSystem missing");
    if (!this.aiSystem) logger.warn("LifeCycleSystem: AISystem missing");
    if (!this.inventorySystem)
      logger.warn("LifeCycleSystem: InventorySystem missing");
    if (!this.householdSystem)
      logger.warn("LifeCycleSystem: HouseholdSystem missing");
    if (!this.socialSystem)
      logger.warn("LifeCycleSystem: SocialSystem missing");
    if (!this.marriageSystem)
      logger.warn("LifeCycleSystem: MarriageSystem missing");
    if (!this.genealogySystem)
      logger.warn("LifeCycleSystem: GenealogySystem missing");
    if (!this.divineFavorSystem)
      logger.warn("LifeCycleSystem: DivineFavorSystem missing");
  }

  public update(_deltaTimeMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < 1000) {
      this.checkDependencies(); // Ensure dependencies are checked at least once or periodically
      return;
    }

    const dtSec = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Resource consumption every 60s
    if (now - this.lastResourceConsumption >= 60000) {
      this.consumeResourcesPeriodically();
      this.lastResourceConsumption = now;
    }

    const yearInc = dtSec / this.config.secondsPerYear;
    const agents = this.gameState.agents || [];
    console.log(`[LifeCycleSystem] Updating ${agents.length} agents. dtSec=${dtSec}, yearInc=${yearInc}`);

    for (const agent of agents) {
      if (agent.immortal) {
        if (agent.lifeStage === "adult") {
          this.queueHousingAssignment(agent.id);
        }
        continue;
      }

      agent.ageYears += yearInc;
      console.log(`[LifeCycleSystem] Agent ${agent.id} aged to ${agent.ageYears}`);
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
        console.log(`[LifeCycleSystem] Agent ${agent.id} died of old age (${agent.ageYears} > ${this.config.maxAge})`);
        this.removeAgent(agent.id);
      }

      if (agent.lifeStage === "adult") {
        this.queueHousingAssignment(agent.id);
      }
    }

    this.tryBreeding(now);
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

    // Process a few assignments per tick
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
      // Logic for consumption...
      // Simplified for brevity, assumes InventorySystem handles details
      const needs = { food: 1, water: 1 }; // Base needs
      this.inventorySystem.consumeFromAgent(agent.id, needs);
    }
  }

  private async tryBreeding(now: number): Promise<void> {
    const agents = this.gameState.agents || [];
    if (agents.length >= this.config.maxPopulation) return;

    // Simple random breeding logic
    // In a real implementation, this would be more complex (as seen in frontend)
    // For now, we'll implement the core check

    const adults = agents.filter((a) => a.lifeStage === "adult");
    const males = adults.filter((a) => a.sex === "male");
    const females = adults.filter((a) => a.sex === "female");

    if (males.length === 0 || females.length === 0) return;

    if (Math.random() < 0.05) {
      // 5% chance per second
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

    // Success!
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

    const profile: AgentProfile = {
      id,
      name: partial.name || `Agent ${id}`,
      sex: partial.sex || "female",
      ageYears: 0,
      lifeStage: "child",
      generation: partial.generation || 0,
      birthTimestamp: Date.now(),
      immortal: false,
      traits: this.randomTraits(),
      socialStatus: "commoner",
      ...partial,
    };

    if (!this.gameState.agents) this.gameState.agents = [];
    this.gameState.agents.push(profile);

    // Initialize Needs
    if (this.needsSystem) {
      this.needsSystem.initializeEntityNeeds(id);
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
      bravery: Math.random(),
      intelligence: Math.random(),
      charisma: Math.random(),
      stamina: Math.random(),
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
      simulationEvents.emit(GameEventNames.ANIMAL_DIED, { entityId: id }); // Using ANIMAL_DIED as generic death or add AGENT_DEATH if exists
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
