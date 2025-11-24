import type { GameState } from "../../types/game-types.js";
import type {
  Ancestor,
  FamilyTree,
  GenealogyEvent,
} from "../types/genealogy.js";
import type { AgentProfile } from "../types/agents.js";

interface GenealogyConfig {
  mutationRate: number;
  trackHistory: boolean;
  maxHistoryEvents: number;
}

export class GenealogySystem {
  private _gameState: GameState;
  private config: GenealogyConfig;
  private familyTree: FamilyTree = {
    lineages: new Map(),
    ancestors: new Map(),
    relationships: new Map(),
  };
  private history: GenealogyEvent[] = [];

  constructor(gameState: GameState, config?: Partial<GenealogyConfig>) {
    this._gameState = gameState;
    this.config = {
      mutationRate: 0.15,
      trackHistory: true,
      maxHistoryEvents: 500,
      ...config,
    };
  }

  public registerBirth(
    agent: AgentProfile,
    fatherId?: string,
    motherId?: string,
  ): void {
    // Simplified logic for migration
    let lineageId = "unknown";

    if (fatherId) {
      const father = this.familyTree.ancestors.get(fatherId);
      if (father) lineageId = father.lineageId;
    } else if (motherId) {
      const mother = this.familyTree.ancestors.get(motherId);
      if (mother) lineageId = mother.lineageId;
    }

    if (lineageId === "unknown") {
      lineageId = this.createNewLineage(agent);
    }

    const ancestor: Ancestor = {
      id: agent.id,
      name: agent.name,
      generation: agent.generation,
      birthTimestamp: agent.birthTimestamp,
      parents: { father: fatherId, mother: motherId },
      children: [],
      traits: agent.traits,
      lineageId,
    };

    this.familyTree.ancestors.set(agent.id, ancestor);

    const lineage = this.familyTree.lineages.get(lineageId);
    if (lineage) {
      lineage.members.push(agent.id);
      lineage.livingMembers.push(agent.id);
      lineage.totalBorn++;
    }

    this.recordEvent({
      type: "birth",
      timestamp: Date.now(),
      agentId: agent.id,
      lineageId,
    });
  }

  private createNewLineage(founder: AgentProfile): string {
    const id = `lineage_${founder.id}`;
    this.familyTree.lineages.set(id, {
      id,
      surname: "Founder", // Stub
      founder: founder.id,
      foundedAt: Date.now(),
      members: [],
      livingMembers: [],
      generation: founder.generation,
      averageTraits: founder.traits,
      totalBorn: 0,
      totalDied: 0,
      favor: 0,
      achievements: [],
      knownRecipes: [],
      researchProgress: new Map(),
      specializations: [],
      culturalBonus: 0,
      knowledgeLevel: 0
    });
    return id;
  }

  private recordEvent(event: GenealogyEvent): void {
    if (!this.config.trackHistory) return;
    this.history.push(event);
    if (this.history.length > this.config.maxHistoryEvents) {
      this.history.shift();
    }
  }
}
