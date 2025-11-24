import { GameState } from "../../types/game-types";
import { SocialConfig } from "../../types/simulation/social";

export class SocialSystem {
  private gameState: GameState;
  private config: SocialConfig;
  private edges = new Map<string, Map<string, number>>();

  constructor(gameState: GameState, config?: Partial<SocialConfig>) {
    this.gameState = gameState;
    this.config = {
      proximityRadius: 100,
      reinforcementPerSecond: 0.05,
      decayPerSecond: 0.01,
      groupThreshold: 0.6,
      ...config,
    };
  }

  public update(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;

    this.decayEdges(dt);
    this.updateProximity(dt);
  }

  private decayEdges(dt: number): void {
    this.edges.forEach((neighbors) => {
      neighbors.forEach((affinity, neighborId) => {
        if (affinity > 0) {
          const newAffinity = Math.max(
            0,
            affinity - this.config.decayPerSecond * dt,
          );
          neighbors.set(neighborId, newAffinity);
        }
      });
    });
  }

  private updateProximity(dt: number): void {
    const entities = this.gameState.entities;
    if (!entities || entities.length < 2) return;

    const radiusSq = this.config.proximityRadius * this.config.proximityRadius;
    const reinforcement = this.config.reinforcementPerSecond * dt;

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];

        if (!a.position || !b.position) continue;

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          this.addEdge(a.id, b.id, reinforcement);
        }
      }
    }
  }

  public addEdge(a: string, b: string, delta: number): void {
    if (a === b) return;
    if (!this.edges.has(a)) this.edges.set(a, new Map());
    if (!this.edges.has(b)) this.edges.set(b, new Map());

    const currentA = this.edges.get(a)!.get(b) || 0;
    this.edges.get(a)!.set(b, Math.max(-1, Math.min(1, currentA + delta)));

    const currentB = this.edges.get(b)!.get(a) || 0;
    this.edges.get(b)!.set(a, Math.max(-1, Math.min(1, currentB + delta)));
  }

  public getAffinityBetween(a: string, b: string): number {
    if (a === b) return 1;
    return this.edges.get(a)?.get(b) ?? 0;
  }

  public imposeTruce(aId: string, bId: string, _durationMs: number): void {
    void _durationMs;
    this.addEdge(aId, bId, 0.2);
  }

  public setAffinity(aId: string, bId: string, value: number): void {
    if (!this.edges.has(aId)) this.edges.set(aId, new Map());
    if (!this.edges.has(bId)) this.edges.set(bId, new Map());
    this.edges.get(aId)!.set(bId, Math.max(-1, Math.min(1, value)));
    this.edges.get(bId)!.set(aId, Math.max(-1, Math.min(1, value)));
  }

  public modifyAffinity(aId: string, bId: string, delta: number): void {
    this.addEdge(aId, bId, delta);
  }

  public removeRelationships(agentId: string): void {
    this.edges.delete(agentId);
    this.edges.forEach((neighbors) => {
      neighbors.delete(agentId);
    });
  }

  /**
   * Register a friendly interaction between two agents (used when agents help each other)
   */
  public registerFriendlyInteraction(aId: string, bId: string): void {
    // Friendly interactions boost affinity
    this.addEdge(aId, bId, 0.15);
  }

  /**
   * Impose local truces around a center position (used by guards in defense zones)
   */
  public imposeLocalTruces(
    centerAgentId: string,
    radius: number,
    durationMs: number,
  ): void {
    const entities = this.gameState.entities;
    if (!entities) return;

    const centerEntity = entities.find((e) => e.id === centerAgentId);
    if (!centerEntity?.position) return;

    const radiusSq = radius * radius;

    const nearbyEntities = entities.filter((e) => {
      if (e.id === centerAgentId || !e.position) return false;
      const dx = e.position.x - centerEntity.position!.x;
      const dy = e.position.y - centerEntity.position!.y;
      return dx * dx + dy * dy <= radiusSq;
    });

    for (let i = 0; i < nearbyEntities.length; i++) {
      for (let j = i + 1; j < nearbyEntities.length; j++) {
        this.imposeTruce(
          nearbyEntities[i].id,
          nearbyEntities[j].id,
          durationMs,
        );
      }
    }
  }
}
