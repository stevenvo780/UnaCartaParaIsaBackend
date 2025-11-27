import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type {
  AmbientSnapshot,
  CollectiveWellbeing,
  AmbientState,
} from "../../types/simulation/ambient";
import {
  CrisisTrend,
  AmbientMood,
  WeatherType,
} from "../../../shared/constants/AmbientEnums";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class AmbientAwarenessSystem {
  private snapshot: AmbientSnapshot;
  private wellbeingHistory: number[] = [];
  private readonly HISTORY_SIZE = 60;

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
        musicMood: "neutral",
        lightingTint: 0xffffff,
        particleIntensity: 0.5,
        worldPulseRate: 1,
        weatherBias: WeatherType.CLEAR,
      },
      lastUpdated: Date.now(),
    };
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    const wellbeing = this.computeWellbeing();
    const ambientState = this.computeAmbientState(wellbeing);

    this.snapshot = {
      wellbeing,
      ambientState,
      lastUpdated: now,
    };

    this.gameState.ambientMood = this.snapshot;
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

    let trend: CollectiveWellbeing["trend"] = CrisisTrend.STABLE;
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
      return "harmonious";
    if (wellbeing.mood === AmbientMood.COMFORTABLE) return "neutral";
    if (wellbeing.mood === AmbientMood.STRESSED) return "tense";
    if (wellbeing.mood === AmbientMood.CRISIS) return "ominous";
    if (wellbeing.mood === AmbientMood.COLLAPSE) return "chaotic";
    return "neutral";
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
    trend: CollectiveWellbeing["trend"],
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
    else if (trend === "worsening") base *= 1.1;

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
}
