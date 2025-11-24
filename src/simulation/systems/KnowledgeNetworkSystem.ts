import { GameState } from "../../types/game-types.js";
import { simulationEvents } from "../events.js";

export interface KnowledgeNode {
  id: string;
  type: 'fact' | 'recipe' | 'location' | 'person';
  data: unknown;
  discoveredBy: string[];
  discoveryTime: number;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  weight: number;
  type: 'related' | 'prerequisite' | 'derived';
}

export class KnowledgeNetworkSystem {
  private gameState: GameState;
  private nodes = new Map<string, KnowledgeNode>();
  private edges: KnowledgeEdge[] = [];
  private agentKnowledge = new Map<string, Set<string>>(); // agentId -> Set<nodeId>

  constructor(gameState: GameState) {
    this.gameState = gameState;
    console.log('🧠 KnowledgeNetworkSystem (Backend) initialized');
  }

  public update(_deltaTimeMs: number): void {}

  public addKnowledge(id: string, type: KnowledgeNode['type'], data: unknown, discovererId?: string): void {
    if (this.nodes.has(id)) return;

    const node: KnowledgeNode = {
      id,
      type,
      data,
      discoveredBy: discovererId ? [discovererId] : [],
      discoveryTime: Date.now(),
    };

    this.nodes.set(id, node);

    if (discovererId) {
      this.learnKnowledge(discovererId, id);
    }

    simulationEvents.emit('KNOWLEDGE_ADDED', { node });
  }

  public learnKnowledge(agentId: string, nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) return false;

    let knowledge = this.agentKnowledge.get(agentId);
    if (!knowledge) {
      knowledge = new Set();
      this.agentKnowledge.set(agentId, knowledge);
    }

    if (knowledge.has(nodeId)) return false;

    knowledge.add(nodeId);

    const node = this.nodes.get(nodeId)!;
    if (!node.discoveredBy.includes(agentId)) {
      node.discoveredBy.push(agentId);
    }

    simulationEvents.emit('KNOWLEDGE_LEARNED', {
      agentId,
      nodeId,
      timestamp: Date.now()
    });

    return true;
  }

  public shareKnowledge(fromAgentId: string, toAgentId: string, nodeId: string): boolean {
    const fromKnowledge = this.agentKnowledge.get(fromAgentId);
    if (!fromKnowledge?.has(nodeId)) return false;

    const learned = this.learnKnowledge(toAgentId, nodeId);

    if (learned) {
      simulationEvents.emit('KNOWLEDGE_SHARED', {
        fromAgentId,
        toAgentId,
        nodeId,
        timestamp: Date.now()
      });
      console.log(`🧠 Knowledge shared: ${fromAgentId} -> ${toAgentId} (${nodeId})`);
    }

    return learned;
  }

  public getGraphSnapshot() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }
}
