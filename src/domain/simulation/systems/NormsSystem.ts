import { GameState } from "../../types/game-types";
import {
  NormViolation,
  SanctionRecord,
  GuardDispatch,
  NormComplianceStats,
} from "../../types/simulation/norms";

export class NormsSystem {
  private gameState: GameState;
  private violations: NormViolation[] = [];
  private sanctionHistory: SanctionRecord[] = [];
  private guardDispatches: GuardDispatch[] = [];
  private readonly MAX_HISTORY = 200;
  private firstViolationTime: number | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public handleCombatInZone(
    attackerId: string,
    targetId: string,
    zoneId: string,
    zoneType: string,
    _position?: { x: number; y: number } // position parameter kept for API compatibility but not currently used
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

    return {
      violated: true,
      sanction,
    };
  }

  public dispatchGuard(
    guardId: string,
    targetLocation: { x: number; y: number },
    zoneId: string,
    distance: number
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

    // Mark last violation as having guard dispatched
    const lastViolation = this.violations[this.violations.length - 1];
    if (lastViolation && lastViolation.zoneId === zoneId) {
      lastViolation.guardDispatched = true;
    }
  }

  private isProtectedZone(zoneType: string): boolean {
    return zoneType === "social" || zoneType === "market";
  }

  public update(): void {
    // Could implement time-based violation decay or guard return logic

    // Escribir estado en GameState para sincronización con frontend
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
    // Los truces vienen del ConflictResolutionSystem, se actualizarán allí
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

  public cleanup(): void {
    this.violations = [];
    this.sanctionHistory = [];
    this.guardDispatches = [];
  }
}
