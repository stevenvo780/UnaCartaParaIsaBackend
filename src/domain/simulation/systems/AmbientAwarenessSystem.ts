import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type {
  AmbientSnapshot,
  CollectiveWellbeing,
  AmbientState,
  AmbientMood,
} from "../../types/simulation/ambient";

export class AmbientAwarenessSystem {
  private snapshot: AmbientSnapshot;
  private wellbeingHistory: number[] = [];
  private readonly HISTORY_SIZE = 60;

  constructor(
    private readonly gameState: GameState,
    private readonly needsSystem: NeedsSystem,
  ) {
    this.snapshot = {
      wellbeing: {
        average: 75,
        variance: 0.5,
        trend: "stable",
        criticalCount: 0,
        totalAgents: 0,
        mood: "comfortable",
      },
      ambientState: {
        musicMood: "neutral",
        lightingTint: 0xffffff,
        particleIntensity: 0.5,
        worldPulseRate: 1,
        weatherBias: "clear",
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

    let trend: CollectiveWellbeing["trend"] = "stable";
    if (this.wellbeingHistory.length >= 10) {
      const recent =
        this.wellbeingHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const older =
        this.wellbeingHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
      if (recent > older + 2) trend = "improving";
      else if (recent < older - 2) trend = "worsening";
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
    if (average >= 80 && criticalPercent < 5) return "thriving";
    if (average >= 60 && criticalPercent < 15) return "comfortable";
    if (average >= 40 && criticalPercent < 30) return "stressed";
    if (average >= 20) return "crisis";
    return "collapse";
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
    if (wellbeing.mood === "thriving" && wellbeing.trend === "improving")
      return "harmonious";
    if (wellbeing.mood === "comfortable") return "neutral";
    if (wellbeing.mood === "stressed") return "tense";
    if (wellbeing.mood === "crisis") return "ominous";
    if (wellbeing.mood === "collapse") return "chaotic";
    return "neutral";
  }

  private resolveTint(mood: AmbientMood): number {
    switch (mood) {
      case "thriving":
        return 0xffffcc;
      case "comfortable":
        return 0xffffff;
      case "stressed":
        return 0xccccff;
      case "crisis":
        return 0xff9999;
      case "collapse":
        return 0x994444;
      default:
        return 0xffffff;
    }
  }

  private resolveParticleIntensity(mood: AmbientMood): number {
    switch (mood) {
      case "thriving":
        return 0.8;
      case "comfortable":
        return 0.4;
      case "stressed":
        return 0.3;
      case "crisis":
        return 0.6;
      case "collapse":
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
      case "thriving":
        base = 0.6;
        break;
      case "comfortable":
        base = 0.8;
        break;
      case "stressed":
        base = 1.2;
        break;
      case "crisis":
        base = 1.8;
        break;
      case "collapse":
        base = 2.4;
        break;
    }

    if (trend === "improving") base *= 0.9;
    else if (trend === "worsening") base *= 1.1;

    return base;
  }

  private resolveWeatherBias(mood: AmbientMood): "clear" | "cloudy" | "stormy" {
    switch (mood) {
      case "thriving":
      case "comfortable":
        return "clear";
      case "stressed":
        return "cloudy";
      case "crisis":
      case "collapse":
        return "stormy";
      default:
        return "clear";
    }
  }
}
