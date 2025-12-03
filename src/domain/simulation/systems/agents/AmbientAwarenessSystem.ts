import { GameState } from "@/shared/types/game-types";
import { NeedsSystem } from "./needs/NeedsSystem";
import type {
  AmbientSnapshot,
  CollectiveWellbeing,
  AmbientState,
  NeedDesireSnapshot,
  ResourceAttractionFieldSnapshot,
  ResourceAttractionSnapshot,
  ResourceEmergencyRequest,
  ResourceBiasSnapshot,
} from "@/shared/types/simulation/ambient";
import {
  CrisisTrend,
  AmbientMood,
  WeatherType,
  MusicMood,
} from "../../../../shared/constants/AmbientEnums";
import { NeedType } from "../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../shared/constants/ResourceEnums";
import { logger } from "@/infrastructure/utils/logger";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../../config/Types";
import { SystemProperty } from "../../../../shared/constants/SystemEnums";

const DESIRE_THRESHOLDS: Partial<
  Record<NeedType, { high: number; low?: number }>
> = {
  [NeedType.HUNGER]: { high: 60 },
  [NeedType.THIRST]: { high: 60 },
  [NeedType.ENERGY]: { high: 0, low: 35 },
  [NeedType.HYGIENE]: { high: 0, low: 40 },
};

const RESOURCE_MAPPING: Partial<Record<NeedType, ResourceType | null>> = {
  [NeedType.HUNGER]: ResourceType.FOOD,
  [NeedType.THIRST]: ResourceType.WATER,
  [NeedType.ENERGY]: null,
  [NeedType.HYGIENE]: ResourceType.WATER,
};

/**
 * Unified system for ambient awareness and resource attraction.
 *
 * Features (merged from AmbientAwarenessSystem + ResourceAttractionSystem):
 * - Collective wellbeing calculations (average, variance, trend)
 * - Ambient mood, lighting, music based on wellbeing
 * - Resource desire calculations based on agent needs
 * - Emergency resource requests when needs are critical
 *
 * @see NeedsSystem for agent need data
 */
@injectable()
export class AmbientAwarenessSystem {
  private snapshot: AmbientSnapshot;
  private wellbeingHistory: number[] = [];
  private readonly HISTORY_SIZE = 60;

  private resourceSnapshot: ResourceAttractionSnapshot;

  constructor(
    @inject(TYPES.GameState) private readonly gameState: GameState,
    @inject(TYPES.NeedsSystem) private readonly needsSystem: NeedsSystem,
  ) {
    this.snapshot = {
      wellbeing: {
        average: 75,
        variance: 0.5,
        trend: CrisisTrend.STABLE,
        criticalCount: 0,
        totalAgents: 0,
        mood: AmbientMood.COMFORTABLE,
      },
      ambientState: {
        musicMood: MusicMood.NEUTRAL,
        lightingTint: 0xffffff,
        particleIntensity: 0.5,
        worldPulseRate: 1,
        weatherBias: WeatherType.CLEAR,
      },
      lastUpdated: Date.now(),
    };

    this.resourceSnapshot = {
      updatedAt: Date.now(),
      desires: [],
      fields: [],
      stats: {
        totalDesires: 0,
        activeZones: 0,
        attractedSpawns: 0,
        emergencyRequests: 0,
      },
      emergencies: [],
    };
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    const wellbeing = this.computeWellbeing();
    const ambientState = this.computeAmbientState(wellbeing);

    // Debug log every 10 seconds
    if (Math.floor(now / 10000) !== Math.floor((now - 1000) / 10000)) {
      logger.debug(
        `🌡️ [AmbientAwarenessSystem] update: wellbeing=${wellbeing.average.toFixed(1)}, variance=${wellbeing.variance.toFixed(2)}, state=${ambientState}`,
      );
    }

    this.snapshot = {
      wellbeing,
      ambientState,
      lastUpdated: now,
    };

    this.gameState.ambientMood = this.snapshot;

    this.updateResourceAttraction(now);
  }

  public getSnapshot(): AmbientSnapshot {
    return this.snapshot;
  }

  private computeWellbeing(): CollectiveWellbeing {
    const samples = this.needsSystem.getAllNeeds();
    const samplesList = Array.from(samples.values());
    if (samplesList.length === 0) {
      return this.snapshot.wellbeing;
    }

    let total = 0;
    let critical = 0;

    for (const data of samplesList) {
      const wellbeing =
        100 -
        (data.hunger +
          data.thirst +
          (100 - data.energy) +
          (100 - data.hygiene)) /
          4;
      total += wellbeing;
      if (data.hunger > 80 || data.thirst > 80 || data.energy < 20) {
        critical++;
      }
    }

    const average = total / samplesList.length;
    let varianceSum = 0;
    for (const data of samplesList) {
      const wellbeing =
        100 -
        (data.hunger +
          data.thirst +
          (100 - data.energy) +
          (100 - data.hygiene)) /
          4;
      varianceSum += Math.pow(wellbeing - average, 2);
    }
    const variance = Math.sqrt(varianceSum / samplesList.length) / 100;

    this.wellbeingHistory.push(average);
    if (this.wellbeingHistory.length > this.HISTORY_SIZE) {
      this.wellbeingHistory.shift();
    }

    let trend: CollectiveWellbeing[SystemProperty.TREND] = CrisisTrend.STABLE;
    if (this.wellbeingHistory.length >= 10) {
      const recent =
        this.wellbeingHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const older =
        this.wellbeingHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
      if (recent > older + 2) trend = CrisisTrend.IMPROVING;
      else if (recent < older - 2) trend = CrisisTrend.WORSENING;
    }

    const criticalPercent = (critical / samplesList.length) * 100;
    const mood = this.resolveMood(average, criticalPercent);

    return {
      average,
      variance,
      trend,
      criticalCount: critical,
      totalAgents: samplesList.length,
      mood,
    };
  }

  private resolveMood(average: number, criticalPercent: number): AmbientMood {
    if (average >= 80 && criticalPercent < 5) return AmbientMood.THRIVING;
    if (average >= 60 && criticalPercent < 15) return AmbientMood.COMFORTABLE;
    if (average >= 40 && criticalPercent < 30) return AmbientMood.STRESSED;
    if (average >= 20) return AmbientMood.CRISIS;
    return AmbientMood.COLLAPSE;
  }

  private computeAmbientState(wellbeing: CollectiveWellbeing): AmbientState {
    const musicMood = this.resolveMusicMood(wellbeing);
    const lightingTint = this.resolveTint(wellbeing.mood);
    const particleIntensity = this.resolveParticleIntensity(wellbeing.mood);
    const worldPulseRate = this.resolvePulseRate(
      wellbeing.mood,
      wellbeing.trend,
    );
    const weatherBias = this.resolveWeatherBias(wellbeing.mood);

    return {
      musicMood,
      lightingTint,
      particleIntensity,
      worldPulseRate,
      weatherBias,
    };
  }

  private resolveMusicMood(wellbeing: CollectiveWellbeing): string {
    if (
      wellbeing.mood === AmbientMood.THRIVING &&
      wellbeing.trend === CrisisTrend.IMPROVING
    )
      return MusicMood.HARMONIOUS;
    if (wellbeing.mood === AmbientMood.COMFORTABLE) return MusicMood.NEUTRAL;
    if (wellbeing.mood === AmbientMood.STRESSED) return MusicMood.TENSE;
    if (wellbeing.mood === AmbientMood.CRISIS) return MusicMood.OMINOUS;
    if (wellbeing.mood === AmbientMood.COLLAPSE) return MusicMood.CHAOTIC;
    return MusicMood.NEUTRAL;
  }

  private resolveTint(mood: AmbientMood): number {
    switch (mood) {
      case AmbientMood.THRIVING:
        return 0xffffcc;
      case AmbientMood.COMFORTABLE:
        return 0xffffff;
      case AmbientMood.STRESSED:
        return 0xccccff;
      case AmbientMood.CRISIS:
        return 0xff9999;
      case AmbientMood.COLLAPSE:
        return 0x994444;
      default:
        return 0xffffff;
    }
  }

  private resolveParticleIntensity(mood: AmbientMood): number {
    switch (mood) {
      case AmbientMood.THRIVING:
        return 0.8;
      case AmbientMood.COMFORTABLE:
        return 0.4;
      case AmbientMood.STRESSED:
        return 0.3;
      case AmbientMood.CRISIS:
        return 0.6;
      case AmbientMood.COLLAPSE:
        return 0.9;
      default:
        return 0.5;
    }
  }

  private resolvePulseRate(
    mood: AmbientMood,
    trend: CollectiveWellbeing[SystemProperty.TREND],
  ): number {
    let base = 1;
    switch (mood) {
      case AmbientMood.THRIVING:
        base = 0.6;
        break;
      case AmbientMood.COMFORTABLE:
        base = 0.8;
        break;
      case AmbientMood.STRESSED:
        base = 1.2;
        break;
      case AmbientMood.CRISIS:
        base = 1.8;
        break;
      case AmbientMood.COLLAPSE:
        base = 2.4;
        break;
    }

    if (trend === CrisisTrend.IMPROVING) base *= 0.9;
    else if (trend === CrisisTrend.WORSENING) base *= 1.1;

    return base;
  }

  private resolveWeatherBias(mood: AmbientMood): WeatherType {
    switch (mood) {
      case AmbientMood.THRIVING:
      case AmbientMood.COMFORTABLE:
        return WeatherType.CLEAR;
      case AmbientMood.STRESSED:
        return WeatherType.CLOUDY;
      case AmbientMood.CRISIS:
      case AmbientMood.COLLAPSE:
        return WeatherType.STORMY;
      default:
        return WeatherType.CLEAR;
    }
  }

  private updateResourceAttraction(now: number): void {
    const needs = this.needsSystem.getAllNeeds();
    const desires: NeedDesireSnapshot[] = [];
    const fieldMap = new Map<
      string,
      { total: number; needs: Map<string, number> }
    >();
    const emergencies: ResourceEmergencyRequest[] = [];

    for (const [entityId, data] of needs) {
      const zoneId = "global";
      (Object.keys(DESIRE_THRESHOLDS) as NeedType[]).forEach((needType) => {
        const thresholds = DESIRE_THRESHOLDS[needType];
        const value = data[needType] as number;
        if (typeof value !== "number") return;

        if (needType === NeedType.ENERGY || needType === NeedType.HYGIENE) {
          if (
            thresholds &&
            typeof thresholds.low === "number" &&
            value < thresholds.low
          ) {
            const intensity = thresholds.low - value;
            this.addDesire(
              desires,
              fieldMap,
              entityId,
              needType,
              zoneId,
              intensity,
              now,
            );
            if (value < 10) {
              const resourceType = RESOURCE_MAPPING[needType];
              if (resourceType) {
                emergencies.push({
                  agentId: entityId,
                  resourceType,
                  urgency: 1 - value / 100,
                  zoneId,
                  timestamp: now,
                });
              }
            }
          }
        } else if (thresholds && value > thresholds.high) {
          const intensity = value - thresholds.high;
          this.addDesire(
            desires,
            fieldMap,
            entityId,
            needType,
            zoneId,
            intensity,
            now,
          );
          if (value > 95) {
            const resourceType = RESOURCE_MAPPING[needType];
            if (resourceType) {
              emergencies.push({
                agentId: entityId,
                resourceType,
                urgency: value / 100,
                zoneId,
                timestamp: now,
              });
            }
          }
        }
      });
    }

    const fields: ResourceAttractionFieldSnapshot[] = [];
    fieldMap.forEach((data, zoneId) => {
      const dominantNeeds: ResourceBiasSnapshot[] = Array.from(
        data.needs.entries(),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([resourceType, intensity]) => ({
          resourceType: resourceType as ResourceType,
          intensity,
        }));

      const totalDesire = data.total;
      const spawnBias = Math.min(
        1,
        totalDesire / Math.max(1, desires.length * 10),
      );

      fields.push({
        zoneId,
        totalDesire,
        spawnBias,
        lastSpawn: now,
        dominantNeeds,
      });
    });

    fields.sort((a, b) => b.totalDesire - a.totalDesire);

    this.resourceSnapshot = {
      updatedAt: now,
      desires: desires.slice(-120),
      fields,
      stats: {
        totalDesires: desires.length,
        activeZones: fields.length,
        attractedSpawns: Math.floor(
          fields.reduce((sum, f) => sum + f.spawnBias, 0) * 10,
        ),
        emergencyRequests: emergencies.length,
      },
      emergencies: emergencies.slice(0, 20),
    };

    this.gameState.resourceAttraction = this.resourceSnapshot;
  }

  public getResourceSnapshot(): ResourceAttractionSnapshot {
    return this.resourceSnapshot;
  }

  private addDesire(
    list: NeedDesireSnapshot[],
    fieldMap: Map<string, { total: number; needs: Map<string, number> }>,
    agentId: string,
    needType: NeedType,
    zoneId: string,
    intensity: number,
    timestamp: number,
  ): void {
    list.push({ agentId, needType, intensity, zoneId, timestamp });

    if (!fieldMap.has(zoneId)) {
      fieldMap.set(zoneId, { total: 0, needs: new Map() });
    }
    const record = fieldMap.get(zoneId)!;
    record.total += intensity;
    const resourceType = RESOURCE_MAPPING[needType];
    if (resourceType) {
      record.needs.set(
        resourceType,
        (record.needs.get(resourceType) || 0) + intensity,
      );
    }
  }
}
