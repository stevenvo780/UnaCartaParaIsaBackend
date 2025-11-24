import { GameState } from "../../types/game-types.js";
import { SocialConfig, SocialGroup } from "../types/social.js";

export class SocialSystem {
  private gameState: GameState;
  private config: SocialConfig;
  private edges = new Map<string, Map<string, number>>();
  private groups: SocialGroup[] = [];
  private lastUpdate = 0;

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
    const now = Date.now();
    const dt = deltaTimeMs / 1000;

    // 1. Decay existing bonds
    this.decayEdges(dt);

    // 2. Proximity updates (Simple O(N^2) for now, optimize with spatial hash later)
    // We need access to entity positions. In a real system, we'd query the spatial index.
    // For this migration, we'll iterate through the GameState entities directly.
    this.updateProximity(dt);
  }

  private decayEdges(dt: number): void {
    this.edges.forEach((neighbors, a) => {
      neighbors.forEach((affinity, b) => {
        if (affinity > 0) {
          // Decay towards 0
          const newAffinity = Math.max(0, affinity - this.config.decayPerSecond * dt);
          neighbors.set(b, newAffinity);
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
          // They are close! Reinforce bond.
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
}
