import { GameState } from "../../types/game-types";
import type { ConflictState } from "../../types/game-types";
import {
  ActiveConflict,
  ConflictRecord,
  MediationAttempt,
  ConflictStats,
} from "../../types/simulation/conflict";

const CONFLICT_CONFIG = {
  truce: {
    lowHealthThreshold: 25,
    heavyHitThreshold: 18,
    chances: {
      lowHealth: 0.7,
      heavyHit: 0.35,
      default: 0.1,
    },
    duration: 60000,
    cardDisplayDuration: 20000,
  },
  friendlyInteraction: {
    truceAcceptBonus: 0.1,
    apologizeBonus: 0.2,
  },
} as const;

export class ConflictResolutionSystem {
  private gameState: GameState;
  private activeCards = new Map<string, { aId: string; bId: string }>();
  private conflictHistory: ConflictRecord[] = [];
  private mediationAttempts: MediationAttempt[] = [];
  private readonly MAX_HISTORY = 200;
  private firstConflictTime: number | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  private createInitialConflictState(): ConflictState {
    return {
      active: [],
      history: [],
      stats: {
        totalConflicts: 0,
        activeNegotiations: 0,
        totalMediations: 0,
        mediationSuccessRate: 0,
        truceAcceptanceRate: 0,
      },
    };
  }

  public handleCombatHit(data: {
    attackerId: string;
    targetId: string;
    remaining: number;
    damage: number;
  }): { shouldProposeTruce: boolean; cardId?: string; reason?: string } {
    if (!this.firstConflictTime) {
      this.firstConflictTime = Date.now();
    }

    const lowHealth =
      data.remaining <= CONFLICT_CONFIG.truce.lowHealthThreshold;
    const heavyHit = data.damage >= CONFLICT_CONFIG.truce.heavyHitThreshold;
    const tryChance = lowHealth
      ? CONFLICT_CONFIG.truce.chances.lowHealth
      : heavyHit
        ? CONFLICT_CONFIG.truce.chances.heavyHit
        : CONFLICT_CONFIG.truce.chances.default;

    if (Math.random() > tryChance) {
      return { shouldProposeTruce: false };
    }

    const cardId = `truce_${data.attackerId}_${data.targetId}_${Date.now()}`;
    this.activeCards.set(cardId, { aId: data.attackerId, bId: data.targetId });

    const reason: MediationAttempt["reason"] = lowHealth
      ? "low_health"
      : heavyHit
        ? "heavy_hit"
        : "default";

    const mediation: MediationAttempt = {
      timestamp: Date.now(),
      cardId,
      attackerId: data.attackerId,
      targetId: data.targetId,
      outcome: "expired",
      reason,
    };
    this.mediationAttempts.push(mediation);
    if (this.mediationAttempts.length > this.MAX_HISTORY) {
      this.mediationAttempts.shift();
    }

    return { shouldProposeTruce: true, cardId, reason };
  }

  public resolveConflict(
    cardId: string,
    choice: "truce_accept" | "apologize" | "continue",
  ): {
    resolved: boolean;
    resolution: ConflictRecord["resolution"];
    truceBonus?: number;
  } {
    const meta = this.activeCards.get(cardId);
    if (!meta) return { resolved: false, resolution: "continued" };

    const { aId, bId } = meta;
    let resolution: ConflictRecord["resolution"] = "continued";
    let truceBonus: number | undefined;

    if (choice === "truce_accept") {
      resolution = "truce_accepted";
      truceBonus = CONFLICT_CONFIG.friendlyInteraction.truceAcceptBonus;
    } else if (choice === "apologize") {
      resolution = "apologized";
      truceBonus = CONFLICT_CONFIG.friendlyInteraction.apologizeBonus;
    }

    const conflict: ConflictRecord = {
      timestamp: Date.now(),
      attackerId: aId,
      targetId: bId,
      resolved: resolution !== "continued",
      resolution,
      cardId,
    };
    this.conflictHistory.push(conflict);
    if (this.conflictHistory.length > this.MAX_HISTORY) {
      this.conflictHistory.shift();
    }

    const mediation = this.mediationAttempts.find((m) => m.cardId === cardId);
    if (mediation) {
      mediation.outcome =
        choice === "truce_accept"
          ? "accepted"
          : choice === "apologize"
            ? "apologized"
            : "rejected";
    }

    this.activeCards.delete(cardId);

    return { resolved: resolution !== "continued", resolution, truceBonus };
  }

  public update(): void {
    // Clean up expired cards
    const now = Date.now();
    const activeCardsEntries: Array<[string, { aId: string; bId: string }]> =
      Array.from(this.activeCards.entries());
    for (const [cardId, meta] of activeCardsEntries) {
      const mediation = this.mediationAttempts.find(
        (m: MediationAttempt) => m.cardId === cardId,
      );
      if (
        mediation &&
        now - mediation.timestamp > CONFLICT_CONFIG.truce.cardDisplayDuration
      ) {
        this.activeCards.delete(cardId);

        const conflict: ConflictRecord = {
          timestamp: now,
          attackerId: meta.aId,
          targetId: meta.bId,
          resolved: false,
          resolution: "expired",
          cardId,
        };
        this.conflictHistory.push(conflict);
        if (this.conflictHistory.length > this.MAX_HISTORY) {
          this.conflictHistory.shift();
        }
      }
    }

    // Escribir estado en GameState para sincronización con frontend
    if (!this.gameState.conflicts) {
      this.gameState.conflicts = this.createInitialConflictState();
    }

    // El frontend espera activeConflicts, no active
    const activeConflicts = this.getActiveConflicts();
    this.gameState.conflicts.active = activeConflicts;
    // También agregar como activeConflicts para compatibilidad con frontend
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.gameState.conflicts as any).activeConflicts = activeConflicts;
    this.gameState.conflicts.history = this.getConflictHistory(50);
    this.gameState.conflicts.stats = this.getConflictStats();

    // También escribir truces en norms para ClientNormsSystem
    if (!this.gameState.norms) {
      this.gameState.norms = {
        violations: [],
        sanctions: [],
        stats: {
          totalViolations: 0,
          protectedZonesCount: 0,
          totalSanctions: 0,
          totalGuardDispatches: 0,
          avgViolationsPerDay: 0,
          mostViolatedZone: null,
        },
        truces: [],
      };
    }
    // Convertir active conflicts a truces para norms
    this.gameState.norms.truces = activeConflicts.map(
      (conflict: ActiveConflict) => ({
        cardId: conflict.cardId,
        attackerId: conflict.attackerId,
        targetId: conflict.targetId,
        expiresAt: conflict.expiresAt,
      }),
    );
  }

  public getActiveConflicts(): ActiveConflict[] {
    const now = Date.now();
    return Array.from(this.activeCards.entries()).map(
      ([cardId, meta]: [string, { aId: string; bId: string }]) => ({
        cardId,
        attackerId: meta.aId,
        targetId: meta.bId,
        startedAt: now,
        expiresAt: now + CONFLICT_CONFIG.truce.cardDisplayDuration,
      }),
    );
  }

  public getConflictHistory(limit = 50): ConflictRecord[] {
    return this.conflictHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getMediationAttempts(limit = 50): MediationAttempt[] {
    return this.mediationAttempts
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getConflictStats(): ConflictStats {
    const totalMediations = this.mediationAttempts.length;
    const successfulMediations = this.mediationAttempts.filter(
      (m) => m.outcome === "accepted" || m.outcome === "apologized",
    ).length;
    const truceAcceptances = this.mediationAttempts.filter(
      (m) => m.outcome === "accepted",
    ).length;

    return {
      totalConflicts: this.conflictHistory.length,
      activeNegotiations: this.activeCards.size,
      totalMediations,
      mediationSuccessRate:
        totalMediations > 0 ? successfulMediations / totalMediations : 0,
      truceAcceptanceRate:
        totalMediations > 0 ? truceAcceptances / totalMediations : 0,
    };
  }

  public cleanup(): void {
    this.activeCards.clear();
    this.conflictHistory = [];
    this.mediationAttempts = [];
  }
}
