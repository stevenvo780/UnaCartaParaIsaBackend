import { GameState } from "@/shared/types/game-types";
import {
  TrustEdge,
  ReputationEntry,
  AgentReputation,
  TrustRelationship,
  ReputationChange,
  SerializedReputationData,
} from "@/shared/types/simulation/reputation";
import { simulationEvents, GameEventType } from "../../core/events";
import { logger } from "../../../../infrastructure/utils/logger";

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

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import type { SocialSystem } from "./SocialSystem";

/**
 * Helper to convert between SocialSystem affinity (-1..1) and trust (0..1).
 * Keeps backward compatibility for consumers of ReputationSystem.
 */
function affinityToTrust(affinity: number): number {
  const clamped = Math.max(-1, Math.min(1, affinity));
  return (clamped + 1) / 2; // -1 -> 0, 0 -> 0.5, 1 -> 1
}

function trustDeltaToAffinityDelta(delta: number): number {
  // Very conservative mapping: small trust deltas become small affinity deltas
  // 1 trust unit ~ 2 affinity units, but we scale down to avoid spikes
  return Math.max(-1, Math.min(1, delta * 2));
}

/**
 * System for managing agent reputation and trust relationships.
 *
 * Features:
 * - Reputation scores per agent (0-1 scale)
 * - Trust relationships between agent pairs
 * - Decay over time toward neutral values
 * - Impact from combat, social interactions, and task completion
 * - Integration with social system for relationship effects
 *
 * @see SocialSystem for social relationship integration
 */
@injectable()
export class ReputationSystem {
  private gameState: GameState;
  private trust = new Map<string, Map<string, TrustEdge>>();
  private reputation = new Map<string, ReputationEntry>();
  private lastUpdate = Date.now();
  private reputationHistory = new Map<string, ReputationChange[]>();
  private readonly MAX_HISTORY_PER_AGENT = 50;

  private statsCache = {
    agents: 0,
    avgReputation: 0.5,
    trustEdges: 0,
    lastUpdate: 0,
  };

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.SocialSystem) @optional() private socialSystem?: SocialSystem,
  ) {
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
    // Prefer SocialSystem as source of truth for pair relationships
    if (this.socialSystem) {
      const affinityDelta = trustDeltaToAffinityDelta(delta);
      this.socialSystem.modifyAffinity(a, b, affinityDelta);
      return;
    }

    const e = this.getEdge(a, b);
    e.value = Math.max(
      REPUTATION_CONFIG.bounds.min,
      Math.min(REPUTATION_CONFIG.bounds.max, e.value + delta),
    );
    e.lastUpdated = Date.now();
  }

  public getTrust(a: string, b: string): number {
    if (this.socialSystem) {
      const affinity = this.socialSystem.getAffinityBetween(a, b);
      return affinityToTrust(affinity);
    }
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

      simulationEvents.emit(GameEventType.REPUTATION_UPDATED, {
        agentId,
        oldValue,
        newValue: r.value,
        delta,
        reason: reason || "unknown",
        timestamp: now,
      });

      if (Math.abs(delta) >= 0.05) {
        logger.debug(
          `⭐ [REPUTATION] ${agentId}: ${oldValue.toFixed(2)} -> ${r.value.toFixed(2)} (${delta > 0 ? "+" : ""}${delta.toFixed(2)}) - ${reason || "unknown"}`,
        );
      }
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

    // Debug log every 10 seconds
    const agentCount = this.reputation.size;
    let trustEdgesCount = 0;
    this.trust.forEach((row) => (trustEdgesCount += row.size));
    if (Math.floor(now / 10000) !== Math.floor((now - dt * 1000) / 10000)) {
      logger.debug(
        `🏆 [ReputationSystem] update: agents=${agentCount}, trustEdges=${trustEdgesCount}, avgRep=${this.statsCache.avgReputation.toFixed(2)}`,
      );
    }

    // If SocialSystem is present, it already decays affinities.
    // Skip decaying local trust map to avoid duplicated effects.
    if (!this.socialSystem) {
      this.trust.forEach((row) => {
        row.forEach((edge) => {
          edge.value +=
            (REPUTATION_CONFIG.decay.targetValue - edge.value) * decay;
          edge.lastUpdated = now;
        });
      });
    }

    let totalRep = 0;
    let repCount = 0;
    this.reputation.forEach((r) => {
      r.value += (REPUTATION_CONFIG.decay.targetValue - r.value) * decay;
      r.lastUpdated = now;
      totalRep += r.value;
      repCount++;
    });

    let trustEdges = 0;
    if (this.socialSystem) {
      // Estimate edges from SocialSystem graph
      // Note: SocialSystem does not expose edges directly; approximate using gameState relationships snapshot if present
      trustEdges = Object.values(this.gameState.socialGraph?.relationships || {}).reduce(
        (acc, targets) => acc + Object.keys(targets).length,
        0,
      );
    } else {
      this.trust.forEach((row) => (trustEdges += row.size));
    }
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
    // Build trust array from SocialSystem if available for snapshot
    let trustArray: Array<{
      sourceId: string;
      targets: Array<{ sourceId: string; targetId: string; trust: number }>;
    }>; 
    if (this.socialSystem && this.gameState.socialGraph?.relationships) {
      trustArray = Object.entries(this.gameState.socialGraph.relationships).map(
        ([sourceId, targets]) => ({
          sourceId,
          targets: Object.entries(targets).map(([targetId, affinity]) => ({
            sourceId,
            targetId,
            trust: affinityToTrust(affinity as number),
          })),
        }),
      );
    } else {
      trustArray = Array.from(this.trust.entries()).map(
        ([sourceId, targetMap]) => ({
          sourceId,
          targets: Array.from(targetMap.entries()).map(([targetId, edge]) => ({
            sourceId,
            targetId,
            trust: edge.value,
          })),
        }),
      );
    }

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

    simulationEvents.emit(GameEventType.INTERACTION_GAME_PLAYED, {
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
    if (this.socialSystem) {
      const rel = this.gameState.socialGraph?.relationships?.[agentId];
      if (!rel) return [];
      return Object.entries(rel).map(([targetId, affinity]) => ({
        sourceId: agentId,
        targetId,
        trust: affinityToTrust(affinity as number),
        lastUpdated: Date.now(),
      }));
    }

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

    if (this.socialSystem && this.gameState.socialGraph?.relationships) {
      for (const [sourceId, targets] of Object.entries(
        this.gameState.socialGraph.relationships,
      )) {
        const arr: Array<{ targetId: string; value: number; lastUpdated: number }> = [];
        for (const [targetId, affinity] of Object.entries(targets)) {
          arr.push({
            targetId,
            value: affinityToTrust(affinity as number),
            lastUpdated: Date.now(),
          });
        }
        trustArray.push({ sourceId, targets: arr });
      }
    } else {
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
    }

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
