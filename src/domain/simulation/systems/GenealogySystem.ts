import type { GameState } from "../../types/game-types";
import type {
  Ancestor,
  FamilyTree,
  GenealogyEvent,
  Lineage,
  SerializedFamilyTree,
} from "../../types/simulation/genealogy";
import type { AgentProfile } from "../../types/simulation/agents";

interface GenealogyConfig {
  mutationRate: number;
  trackHistory: boolean;
  maxHistoryEvents: number;
}

export class GenealogySystem {
  private config: GenealogyConfig;
  private familyTree: FamilyTree = {
    lineages: new Map(),
    ancestors: new Map(),
    relationships: new Map(),
  };
  private history: GenealogyEvent[] = [];

  constructor(_gameState: GameState, config?: Partial<GenealogyConfig>) {
    void _gameState;
    this.config = {
      mutationRate: 0.15,
      trackHistory: true,
      maxHistoryEvents: 500,
      ...config,
    };
  }

  public getAncestor(agentId: string): Ancestor | undefined {
    return this.familyTree.ancestors.get(agentId);
  }

  public registerBirth(
    agent: AgentProfile,
    fatherId?: string,
    motherId?: string,
  ): void {
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
      knowledgeLevel: 0,
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

  public getFamilyTree(): FamilyTree {
    return this.familyTree;
  }

  public getSerializedFamilyTree(): SerializedFamilyTree {
    const ancestorsObj: Record<string, Ancestor> = {};
    this.familyTree.ancestors.forEach((v, k) => {
      ancestorsObj[k] = v;
    });

    const lineagesObj: SerializedFamilyTree["lineages"] = {};
    this.familyTree.lineages.forEach((v: Lineage, k: string) => {
      const serializedResearch: Record<string, number> = {};
      if (v.researchProgress) {
        v.researchProgress.forEach((val: number, key: string) => {
          serializedResearch[key] = val;
        });
      }

      const { researchProgress: _unused, ...lineageWithoutResearch } = v;
      lineagesObj[k] = {
        ...lineageWithoutResearch,
        researchProgress: serializedResearch,
      };
    });

    const relationshipsObj: Record<string, string[]> = {};
    this.familyTree.relationships.forEach((v: string[], k: string) => {
      relationshipsObj[k] = v;
    });

    return {
      ancestors: ancestorsObj,
      lineages: lineagesObj,
      relationships: relationshipsObj,
    };
  }

  public recordDeath(agentId: string): void {
    const ancestor = this.familyTree.ancestors.get(agentId);
    if (!ancestor) return;

    const lineage = this.familyTree.lineages.get(ancestor.lineageId);
    if (lineage) {
      const livingIndex = lineage.livingMembers.indexOf(agentId);
      if (livingIndex !== -1) {
        lineage.livingMembers.splice(livingIndex, 1);
      }
      lineage.totalDied++;
    }

    this.recordEvent({
      type: "death",
      timestamp: Date.now(),
      agentId,
      lineageId: ancestor.lineageId,
    });
  }
}
