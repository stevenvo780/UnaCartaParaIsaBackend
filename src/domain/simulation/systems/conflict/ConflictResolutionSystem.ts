import { GameState } from "@/shared/types/game-types";
import type { ConflictState } from "@/shared/types/game-types";
import { ExplorationType } from "@/shared/constants/AIEnums";
import { TradeOfferStatus } from "@/shared/constants/EconomyEnums";
import {
  ActiveConflict,
  ConflictRecord,
  MediationAttempt,
  ConflictStats,
} from "@/shared/types/simulation/conflict";
import {
  NormViolation,
  SanctionRecord,
  GuardDispatch,
  NormComplianceStats,
} from "@/shared/types/simulation/norms";
import { simulationEvents, GameEventType } from "../../core/events";
import {
  ConflictResolutionChoice,
  ConflictResolution,
} from "../../../../shared/constants/ConflictEnums";
import { SystemProperty } from "../../../../shared/constants/SystemEnums";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";
import { logger } from "@/infrastructure/utils/logger";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../../config/Types";

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

/**
 * Unified system for conflict resolution and norm enforcement.
 *
 * Features (merged from ConflictResolutionSystem + NormsSystem):
 * - Truce proposal during combat (low health, heavy hits)
 * - Norm violation detection (combat in protected zones)
 * - Sanction application with reputation penalties
 * - Guard dispatch for enforcement
 * - Conflict/mediation history tracking
 *
 * @see CombatSystem for combat integration
 * @see ReputationSystem for sanction effects
 */
@injectable()
export class ConflictResolutionSystem {
  private gameState: GameState;
  private activeCards = new Map<string, { aId: string; bId: string }>();
  private conflictHistory: ConflictRecord[] = [];
  private mediationAttempts: MediationAttempt[] = [];
  private readonly MAX_HISTORY = 200;
  private firstConflictTime: number | null = null;

  private violations: NormViolation[] = [];
  private sanctionHistory: SanctionRecord[] = [];
  private guardDispatches: GuardDispatch[] = [];
  private firstViolationTime: number | null = null;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventType.COMBAT_HIT,
      this.handleCombatHitEvent.bind(this),
    );
  }

  private handleCombatHitEvent(data: {
    attackerId: string;
    targetId: string;
    remaining: number;
    damage: number;
  }): void {
    this.handleCombatHit(data);
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
        : ExplorationType.DEFAULT;

    const mediation: MediationAttempt = {
      timestamp: Date.now(),
      cardId,
      attackerId: data.attackerId,
      targetId: data.targetId,
      outcome: TradeOfferStatus.EXPIRED,
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
    resolution: ConflictRecord[SystemProperty.RESOLUTION];
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
            : TradeOfferStatus.REJECTED;
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
      resolved: resolution !== ConflictResolution.CONTINUED,
      [SystemProperty.RESOLUTION]: resolution,
      truceBonus,
    };
  }

  public update(): void {
    const now = Date.now();

    const activeCardsCount = this.activeCards.size;
    const activeConflictsCount = this.getActiveConflicts().length;
    if (Math.floor(now / 10000) !== Math.floor((now - 1000) / 10000)) {
      logger.debug(
        `⚖️ [ConflictResolutionSystem] update: activeCards=${activeCardsCount}, conflicts=${activeConflictsCount}, historySize=${this.conflictHistory.length}`,
      );
    }

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

    this.updateNormsState();

    if (this.gameState.norms) {
      this.gameState.norms.truces = activeConflicts.map(
        (conflict: ActiveConflict) => ({
          cardId: conflict.cardId,
          attackerId: conflict.attackerId,
          targetId: conflict.targetId,
          expiresAt: conflict.expiresAt,
        }),
      );
    }
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
      (m) =>
        m.outcome === TradeOfferStatus.ACCEPTED ||
        m.outcome === ConflictResolution.APOLOGIZED,
    ).length;
    const truceAcceptances = this.mediationAttempts.filter(
      (m) => m.outcome === TradeOfferStatus.ACCEPTED,
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
    this.violations = [];
    this.sanctionHistory = [];
    this.guardDispatches = [];
  }

  public handleCombatInZone(
    attackerId: string,
    targetId: string,
    zoneId: string,
    zoneType: string,
    _position?: { x: number; y: number },
  ): {
    violated: boolean;
    sanction?: SanctionRecord;
    guardDispatch?: { guardId: string; distance: number };
  } {
    if (!this.isProtectedZone(zoneType)) {
      return { violated: false };
    }

    if (!this.firstViolationTime) {
      this.firstViolationTime = Date.now();
    }

    const violation: NormViolation = {
      id: `${attackerId}_${targetId}_${Date.now()}`,
      timestamp: Date.now(),
      attackerId,
      targetId,
      zoneId,
      zoneType,
      sanctionApplied: true,
      reputationPenalty: -0.04,
      guardDispatched: false,
    };

    this.violations.push(violation);
    if (this.violations.length > this.MAX_HISTORY) {
      this.violations.shift();
    }

    const sanction: SanctionRecord = {
      timestamp: Date.now(),
      agentId: attackerId,
      violationType: "violence_in_protected_zone",
      reputationPenalty: -0.04,
      trustPenalty: -0.05,
      truceDuration: 40000,
    };
    this.sanctionHistory.push(sanction);
    if (this.sanctionHistory.length > this.MAX_HISTORY) {
      this.sanctionHistory.shift();
    }

    simulationEvents.emit(GameEventType.NORM_VIOLATED, {
      violationId: violation.id,
      attackerId,
      targetId,
      zoneId,
      zoneType,
      timestamp: Date.now(),
    });

    simulationEvents.emit(GameEventType.NORM_SANCTION_APPLIED, {
      agentId: attackerId,
      violationType: sanction.violationType,
      reputationPenalty: sanction.reputationPenalty,
      trustPenalty: sanction.trustPenalty,
      truceDuration: sanction.truceDuration,
      timestamp: Date.now(),
    });

    return {
      violated: true,
      sanction,
    };
  }

  public dispatchGuard(
    guardId: string,
    targetLocation: { x: number; y: number },
    zoneId: string,
    distance: number,
  ): void {
    const dispatch: GuardDispatch = {
      timestamp: Date.now(),
      guardId,
      targetLocation,
      zoneId,
      distance,
      resolved: false,
    };
    this.guardDispatches.push(dispatch);
    if (this.guardDispatches.length > this.MAX_HISTORY) {
      this.guardDispatches.shift();
    }

    const lastViolation = this.violations[this.violations.length - 1];
    if (lastViolation && lastViolation.zoneId === zoneId) {
      lastViolation.guardDispatched = true;
    }
  }

  private isProtectedZone(zoneType: string): boolean {
    return zoneType === ZoneType.SOCIAL || zoneType === ZoneType.MARKET;
  }

  public getNormViolations(limit = 50): NormViolation[] {
    return this.violations
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getProtectedZones(): Array<{
    zoneId: string;
    zoneType: string;
    violationsCount: number;
  }> {
    const violationCounts = new Map<string, number>();
    for (const v of this.violations) {
      violationCounts.set(v.zoneId, (violationCounts.get(v.zoneId) || 0) + 1);
    }

    const zones = this.gameState.zones || [];
    return zones
      .filter((z) => this.isProtectedZone(z.type))
      .map((z) => ({
        zoneId: z.id,
        zoneType: z.type,
        violationsCount: violationCounts.get(z.id) || 0,
      }));
  }

  public getRecentSanctions(limit = 50): SanctionRecord[] {
    return this.sanctionHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getGuardActivity(limit = 50): GuardDispatch[] {
    return this.guardDispatches
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getNormCompliance(): NormComplianceStats {
    const protectedZones = this.getProtectedZones();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsedDays = this.firstViolationTime
      ? Math.max(1, (now - this.firstViolationTime) / dayMs)
      : 1;

    const zoneViolations = new Map<string, number>();
    for (const v of this.violations) {
      zoneViolations.set(v.zoneId, (zoneViolations.get(v.zoneId) || 0) + 1);
    }

    let mostViolatedZone: string | null = null;
    let maxViolations = 0;
    for (const [zoneId, count] of Array.from(zoneViolations.entries())) {
      if (count > maxViolations) {
        maxViolations = count;
        mostViolatedZone = zoneId;
      }
    }

    return {
      totalViolations: this.violations.length,
      protectedZonesCount: protectedZones.length,
      totalSanctions: this.sanctionHistory.length,
      totalGuardDispatches: this.guardDispatches.length,
      avgViolationsPerDay: this.violations.length / elapsedDays,
      mostViolatedZone,
    };
  }

  private updateNormsState(): void {
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

    this.gameState.norms.violations = this.getNormViolations(50);
    this.gameState.norms.sanctions = this.getRecentSanctions(50);
    this.gameState.norms.stats = this.getNormCompliance();
  }
}
