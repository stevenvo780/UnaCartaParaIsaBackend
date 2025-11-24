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

    // In a real backend, we would use a spatial index here.
    // For now, we stub the spatial query or iterate all pairs if N is small.
    // Since we don't have positions easily accessible in a performant way without a spatial structure,
    // we will skip the proximity update for this migration step and focus on decay.

    this.decayEdges(dt);
  }

  private decayEdges(dt: number): void {
    this.edges.forEach((neighbors, a) => {
      neighbors.forEach((affinity, b) => {
        if (affinity > 0) {
          neighbors.set(b, Math.max(0, affinity - this.config.decayPerSecond * dt));
        }
      });
    });
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
