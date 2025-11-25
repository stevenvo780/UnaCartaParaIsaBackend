import { logger } from "@/infrastructure/utils/logger";
import { GameState } from "../../types/game-types";
import { simulationEvents, GameEventNames } from "../core/events";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

export type KnowledgeNodeData =
  | { type: "fact"; content: string; category?: string }
  | { type: "recipe"; recipeId: string; ingredients: string[] }
  | { type: "location"; x: number; y: number; zoneId?: string }
  | { type: "person"; agentId: string; relationship?: string };

export interface KnowledgeNode {
  id: string;
  type: "fact" | "recipe" | "location" | "person";
  data: KnowledgeNodeData;
  discoveredBy: string[];
  discoveryTime: number;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  weight: number;
  type: "related" | "prerequisite" | "derived";
  cor: number;
}

@injectable()
export class KnowledgeNetworkSystem {
  private gameState: GameState;
  private nodes = new Map<string, KnowledgeNode>();
  private edges: KnowledgeEdge[] = [];
  private agentKnowledge = new Map<string, Set<string>>(); // agentId -> Set<nodeId>

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    logger.info("🧠 KnowledgeNetworkSystem (Backend) initialized");
  }

  public update(_deltaTimeMs: number): void {
    if (!this.gameState.knowledgeGraph) {
      this.gameState.knowledgeGraph = {
        nodes: [],
        links: [],
      };
    }

    const snapshot = this.getGraphSnapshot();
    this.gameState.knowledgeGraph.nodes = snapshot.nodes;
    this.gameState.knowledgeGraph.links = snapshot.edges.map((edge) => {
      const edgeWithCor: KnowledgeEdge = {
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        type: edge.type,
        cor: edge.cor ?? 0,
      };
      return {
        source: edgeWithCor.source,
        target: edgeWithCor.target,
        weight: edgeWithCor.weight,
        type: edgeWithCor.type,
        cor: edgeWithCor.cor,
      };
    });
  }

  public addKnowledge(
    id: string,
    type: KnowledgeNode["type"],
    data: KnowledgeNodeData,
    discovererId?: string,
  ): void {
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

    simulationEvents.emit("KNOWLEDGE_ADDED", { node });
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

    simulationEvents.emit(GameEventNames.KNOWLEDGE_LEARNED, {
      agentId,
      nodeId,
      timestamp: Date.now(),
    });

    return true;
  }

  public shareKnowledge(
    fromAgentId: string,
    toAgentId: string,
    nodeId: string,
  ): boolean {
    const fromKnowledge = this.agentKnowledge.get(fromAgentId);
    if (!fromKnowledge?.has(nodeId)) return false;

    const learned = this.learnKnowledge(toAgentId, nodeId);

    if (learned) {
      simulationEvents.emit(GameEventNames.KNOWLEDGE_SHARED, {
        fromAgentId,
        toAgentId,
        nodeId,
        timestamp: Date.now(),
      });
      logger.info(
        `🧠 Knowledge shared: ${fromAgentId} -> ${toAgentId} (${nodeId})`,
      );
    }

    return learned;
  }

  public getGraphSnapshot(): {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }
}
