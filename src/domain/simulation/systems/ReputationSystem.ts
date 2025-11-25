import { GameState } from "../../types/game-types";
import {
  TrustEdge,
  ReputationEntry,
  AgentReputation,
  TrustRelationship,
  ReputationChange,
  SerializedReputationData,
} from "../../types/simulation/reputation";
import { simulationEvents, GameEventNames } from "../core/events";

const REPUTATION_CONFIG = {
  decay: {
    perSecond: 0.003,
    targetValue: 0.5,
  },
  initialValues: {
    trust: 0.5,
    reputation: 0.5,
  },
  impacts: {
    socialRelation: {
      trust: 0.1,
      reputation: 0.01,
    },
    combat: {
      maxImpact: 0.05,
      damageNormalizer: 200,
    },
    interactionGame: {
      scale: 0.08,
      exploitPenalty: 0.5,
    },
  },
  bounds: {
    min: 0,
    max: 1,
  },
} as const;

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class ReputationSystem {
  private gameState: GameState;
  private trust = new Map<string, Map<string, TrustEdge>>();
  private reputation = new Map<string, ReputationEntry>();
  private lastUpdate = 0;
  private reputationHistory = new Map<string, ReputationChange[]>();
  private readonly MAX_HISTORY_PER_AGENT = 50;

  private statsCache = {
    agents: 0,
    avgReputation: 0.5,
    trustEdges: 0,
    lastUpdate: 0,
  };

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.lastUpdate = Date.now();
  }

  private getEdge(a: string, b: string): TrustEdge {
    if (!this.trust.has(a)) this.trust.set(a, new Map());
    const row = this.trust.get(a)!;
    if (!row.has(b)) {
      row.set(b, {
        value: REPUTATION_CONFIG.initialValues.trust,
        lastUpdated: Date.now(),
      });
    }
    return row.get(b)!;
  }

  public updateTrust(a: string, b: string, delta: number): void {
    const e = this.getEdge(a, b);
    e.value = Math.max(
      REPUTATION_CONFIG.bounds.min,
      Math.min(REPUTATION_CONFIG.bounds.max, e.value + delta),
    );
    e.lastUpdated = Date.now();
  }

  public getTrust(a: string, b: string): number {
    return this.getEdge(a, b).value;
  }

  public updateReputation(
    agentId: string,
    delta: number,
    reason?: string,
  ): void {
    const now = Date.now();
    const r = this.reputation.get(agentId) || {
      value: REPUTATION_CONFIG.initialValues.reputation,
      lastUpdated: now,
    };
    const oldValue = r.value;
    r.value = Math.max(
      REPUTATION_CONFIG.bounds.min,
      Math.min(REPUTATION_CONFIG.bounds.max, r.value + delta),
    );
    r.lastUpdated = now;
    this.reputation.set(agentId, r);

    if (delta !== 0) {
      const change: ReputationChange = {
        timestamp: now,
        agentId,
        oldValue,
        newValue: r.value,
        delta,
        reason: reason || "unknown",
      };

      const history = this.reputationHistory.get(agentId) || [];
      history.push(change);
      if (history.length > this.MAX_HISTORY_PER_AGENT) {
        history.shift();
      }
      this.reputationHistory.set(agentId, history);
    }
  }

  public getReputation(agentId: string): number {
    return (
      this.reputation.get(agentId)?.value ??
      REPUTATION_CONFIG.initialValues.reputation
    );
  }

  public update(): void {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    if (dt < 1) return;
    this.lastUpdate = now;
    const decay = REPUTATION_CONFIG.decay.perSecond * dt;

    this.trust.forEach((row) => {
      row.forEach((edge) => {
        edge.value +=
          (REPUTATION_CONFIG.decay.targetValue - edge.value) * decay;
        edge.lastUpdated = now;
      });
    });

    let totalRep = 0;
    let repCount = 0;
    this.reputation.forEach((r) => {
      r.value += (REPUTATION_CONFIG.decay.targetValue - r.value) * decay;
      r.lastUpdated = now;
      totalRep += r.value;
      repCount++;
    });

    let trustEdges = 0;
    this.trust.forEach((row) => (trustEdges += row.size));
    this.statsCache.agents = this.reputation.size;
    this.statsCache.avgReputation =
      repCount > 0
        ? totalRep / repCount
        : REPUTATION_CONFIG.initialValues.reputation;
    this.statsCache.trustEdges = trustEdges;
    this.statsCache.lastUpdate = now;

    if (!this.gameState.reputation) {
      this.gameState.reputation = {
        data: {
          trust: [],
          reputation: [],
          reputationHistory: [],
        },
        stats: {
          agents: 0,
          avgReputation: 0.5,
          trustEdges: 0,
        },
      };
    }

    this.gameState.reputation.data = this.serialize();
    this.gameState.reputation.stats = this.getSystemStats();

    const allReputations = this.getAllReputations();
    const trustArray = Array.from(this.trust.entries()).map(
      ([sourceId, targetMap]) => ({
        sourceId,
        targets: Array.from(targetMap.entries()).map(([targetId, edge]) => ({
          sourceId,
          targetId,
          trust: edge.value,
        })),
      }),
    );

    this.gameState.reputation.reputations = allReputations;
    this.gameState.reputation.trust = trustArray;
  }

  public handleSocialRelationChanged(data: {
    aId: string;
    bId: string;
    type: "friendship" | "enmity";
    delta: number;
  }): void {
    const sign = data.type === "friendship" ? 1 : -1;
    this.updateTrust(
      data.aId,
      data.bId,
      REPUTATION_CONFIG.impacts.socialRelation.trust *
        sign *
        Math.abs(data.delta),
    );
    this.updateReputation(
      data.aId,
      REPUTATION_CONFIG.impacts.socialRelation.reputation * sign,
      `social_${data.type}`,
    );
    this.updateReputation(
      data.bId,
      REPUTATION_CONFIG.impacts.socialRelation.reputation * sign,
      `social_${data.type}`,
    );
  }

  public handleCombatHit(data: {
    attackerId: string;
    targetId: string;
    damage: number;
  }): void {
    const impact = Math.min(
      REPUTATION_CONFIG.impacts.combat.maxImpact,
      (data.damage || 10) / REPUTATION_CONFIG.impacts.combat.damageNormalizer,
    );
    this.updateTrust(data.targetId, data.attackerId, -impact);
    this.updateReputation(data.attackerId, -impact, "combat_hit");
  }

  public handleInteractionGame(evt: {
    game: "pd" | "ultimatum";
    aId: string;
    bId: string;
    payoffs: Record<string, number>;
  }): void {
    const a = evt.aId;
    const b = evt.bId;
    const pa = evt.payoffs[a] || 0;
    const pb = evt.payoffs[b] || 0;
    const scale = REPUTATION_CONFIG.impacts.interactionGame.scale;

    simulationEvents.emit(GameEventNames.INTERACTION_GAME_PLAYED, {
      game: evt.game,
      agentA: a,
      agentB: b,
      payoffs: evt.payoffs,
      timestamp: Date.now(),
    });

    if (pa > 0 && pb > 0) {
      this.updateTrust(a, b, scale);
      this.updateTrust(b, a, scale);
    } else if (pa > pb) {
      this.updateTrust(b, a, -scale);
      this.updateReputation(
        a,
        -scale * REPUTATION_CONFIG.impacts.interactionGame.exploitPenalty,
        "exploit_gain",
      );
    } else if (pb > pa) {
      this.updateTrust(a, b, -scale);
      this.updateReputation(
        b,
        -scale * REPUTATION_CONFIG.impacts.interactionGame.exploitPenalty,
        "exploit_gain",
      );
    }
  }

  public getSystemStats(): {
    agents: number;
    avgReputation: number;
    trustEdges: number;
  } {
    return {
      agents: this.statsCache.agents,
      avgReputation: this.statsCache.avgReputation,
      trustEdges: this.statsCache.trustEdges,
    };
  }

  public getAllReputations(): AgentReputation[] {
    const allReps = Array.from(this.reputation.entries())
      .map(([agentId, entry]) => ({
        agentId,
        agentName: agentId,
        reputation: entry.value,
        lastUpdated: entry.lastUpdated,
        rank: 0,
      }))
      .sort((a, b) => b.reputation - a.reputation);

    allReps.forEach((rep, index) => {
      rep.rank = index + 1;
    });

    return allReps;
  }

  public getReputationHistory(agentId: string, limit = 20): ReputationChange[] {
    const history = this.reputationHistory.get(agentId) || [];
    return history.slice(-limit).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getTrustNetwork(agentId: string): TrustRelationship[] {
    const trustMap = this.trust.get(agentId);
    if (!trustMap) return [];

    return Array.from(trustMap.entries()).map(([targetId, edge]) => ({
      sourceId: agentId,
      targetId,
      trust: edge.value,
      lastUpdated: edge.lastUpdated,
    }));
  }

  public getTopReputations(limit = 10): AgentReputation[] {
    return this.getAllReputations().slice(0, limit);
  }

  public serialize(): SerializedReputationData {
    const trustArray: SerializedReputationData["trust"] = [];

    this.trust.forEach((targetMap, sourceId) => {
      const targets: Array<{
        targetId: string;
        value: number;
        lastUpdated: number;
      }> = [];
      targetMap.forEach((edge, targetId) => {
        targets.push({
          targetId,
          value: edge.value,
          lastUpdated: edge.lastUpdated,
        });
      });
      trustArray.push({ sourceId, targets });
    });

    const reputationArray = Array.from(this.reputation.entries()).map(
      ([agentId, entry]) => ({
        agentId,
        value: entry.value,
        lastUpdated: entry.lastUpdated,
      }),
    );

    const historyArray = Array.from(this.reputationHistory.entries()).map(
      ([agentId, changes]) => ({
        agentId,
        changes: [...changes],
      }),
    );

    return {
      trust: trustArray,
      reputation: reputationArray,
      reputationHistory: historyArray,
    };
  }

  public deserialize(data: SerializedReputationData): void {
    this.trust.clear();
    for (const source of data.trust) {
      const targetMap = new Map<string, TrustEdge>();
      for (const target of source.targets) {
        targetMap.set(target.targetId, {
          value: target.value,
          lastUpdated: target.lastUpdated,
        });
      }
      this.trust.set(source.sourceId, targetMap);
    }

    this.reputation.clear();
    for (const rep of data.reputation) {
      this.reputation.set(rep.agentId, {
        value: rep.value,
        lastUpdated: rep.lastUpdated,
      });
    }

    this.reputationHistory.clear();
    for (const history of data.reputationHistory) {
      this.reputationHistory.set(history.agentId, history.changes);
    }
  }

  public removeAgent(agentId: string): void {
    this.reputation.delete(agentId);
    this.trust.delete(agentId);
    this.reputationHistory.delete(agentId);

    this.trust.forEach((targetMap) => {
      targetMap.delete(agentId);
    });
  }

  public cleanup(): void {
    this.trust.clear();
    this.reputation.clear();
    this.reputationHistory.clear();
  }
}
