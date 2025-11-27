import { GameState } from "../../types/game-types";
import type { ConflictState } from "../../types/game-types";
import {
  ActiveConflict,
  ConflictRecord,
  MediationAttempt,
  ConflictStats,
} from "../../types/simulation/conflict";
import { simulationEvents, GameEventType } from "../core/events";
import {
  ConflictResolutionChoice,
  ConflictResolution,
} from "../../../shared/constants/ConflictEnums";
import { SystemProperty } from "../../../shared/constants/SystemEnums";

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

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class ConflictResolutionSystem {
  private gameState: GameState;
  private activeCards = new Map<string, { aId: string; bId: string }>();
  private conflictHistory: ConflictRecord[] = [];
  private mediationAttempts: MediationAttempt[] = [];
  private readonly MAX_HISTORY = 200;
  private firstConflictTime: number | null = null;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
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

    simulationEvents.emit(GameEventType.CONFLICT_TRUCE_PROPOSED, {
      cardId,
      attackerId: data.attackerId,
      targetId: data.targetId,
      reason,
      remainingHealth: data.remaining,
      damage: data.damage,
      timestamp: Date.now(),
    });

    return { shouldProposeTruce: true, cardId, reason };
  }

  public resolveConflict(
    cardId: string,
    choice: ConflictResolutionChoice,
  ): {
    resolved: boolean;
    resolution: ConflictRecord["resolution"];
    truceBonus?: number;
  } {
    const meta = this.activeCards.get(cardId);
    if (!meta)
      return {
        resolved: false,
        resolution: ConflictResolution.CONTINUED,
      };

    const { aId: aId, bId: bId } = meta;
    let resolution: ConflictRecord[SystemProperty.RESOLUTION] =
      ConflictResolution.CONTINUED;
    let truceBonus: number | undefined;

    if (choice === ConflictResolutionChoice.TRUCE_ACCEPT) {
      resolution = ConflictResolution.TRUCE_ACCEPTED;
      truceBonus = CONFLICT_CONFIG.friendlyInteraction.truceAcceptBonus;
    } else if (choice === ConflictResolutionChoice.APOLOGIZE) {
      resolution = ConflictResolution.APOLOGIZED;
      truceBonus = CONFLICT_CONFIG.friendlyInteraction.apologizeBonus;
    }

    const conflict: ConflictRecord = {
      timestamp: Date.now(),
      attackerId: aId,
      targetId: bId,
      resolved: resolution !== ConflictResolution.CONTINUED,
      [SystemProperty.RESOLUTION]: resolution,
      cardId,
    };
    this.conflictHistory.push(conflict);
    if (this.conflictHistory.length > this.MAX_HISTORY) {
      this.conflictHistory.shift();
    }

    const mediation = this.mediationAttempts.find((m) => m.cardId === cardId);
    if (mediation) {
      mediation.outcome =
        choice === ConflictResolutionChoice.TRUCE_ACCEPT
          ? "accepted"
          : choice === ConflictResolutionChoice.APOLOGIZE
            ? "apologized"
            : "rejected";
    }

    if (choice === ConflictResolutionChoice.TRUCE_ACCEPT) {
      simulationEvents.emit(GameEventType.CONFLICT_TRUCE_ACCEPTED, {
        cardId,
        attackerId: aId,
        targetId: bId,
        truceBonus,
        timestamp: Date.now(),
      });
    } else if (choice === ConflictResolutionChoice.CONTINUE) {
      simulationEvents.emit(GameEventType.CONFLICT_TRUCE_REJECTED, {
        cardId,
        attackerId: aId,
        targetId: bId,
        timestamp: Date.now(),
      });
    }

    this.activeCards.delete(cardId);

    return {
      resolved: resolution !== "continued",
      [SystemProperty.RESOLUTION]: resolution,
      truceBonus,
    };
  }

  public update(): void {
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
          resolution: ConflictResolution.EXPIRED,
          cardId,
        };
        this.conflictHistory.push(conflict);
        if (this.conflictHistory.length > this.MAX_HISTORY) {
          this.conflictHistory.shift();
        }
      }
    }

    if (!this.gameState.conflicts) {
      this.gameState.conflicts = this.createInitialConflictState();
    }

    const activeConflicts = this.getActiveConflicts();
    this.gameState.conflicts.active = activeConflicts;
    this.gameState.conflicts.activeConflicts = activeConflicts;
    this.gameState.conflicts.history = this.getConflictHistory(50);
    this.gameState.conflicts.stats = this.getConflictStats();

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
