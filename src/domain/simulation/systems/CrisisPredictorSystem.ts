import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type {
  CrisisIndicator,
  CrisisPrediction,
  CrisisSnapshot,
  CrisisSeverity,
  CrisisTrend,
} from "../../types/simulation/ambient";

const INDICATOR_CONFIG: Record<string, { threshold: number; description: string }> = {
  sustainability: {
    threshold: 0.3,
    description: "Sostenibilidad del sistema basado en reservas y consumo",
  },
  resource_balance: {
    threshold: 0.4,
    description: "Balance entre producción y consumo de recursos críticos",
  },
  population_stress: {
    threshold: 0.5,
    description: "Porcentaje de población en estado crítico",
  },
  emergency_rate: {
    threshold: 0.2,
    description: "Incidencia de emergencias simultáneas",
  },
};

export class CrisisPredictorSystem {
  private snapshot: CrisisSnapshot;
  private indicatorHistory = new Map<string, number[]>();
  private readonly MAX_HISTORY = 60;

  constructor(
    private readonly gameState: GameState,
    private readonly needsSystem: NeedsSystem,
  ) {
    this.snapshot = {
      indicators: [],
      predictions: [],
      historySize: 0,
      lastUpdated: Date.now(),
    };
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    const indicators = this.computeIndicators(now);
    const predictions = this.computePredictions(indicators, now);

    this.snapshot = {
      indicators,
      predictions,
      historySize: Math.min(
        ...Array.from(this.indicatorHistory.values()).map((values) => values.length),
      ) || 0,
      lastUpdated: now,
    };

    this.gameState.crisisForecast = this.snapshot;
  }

  public getSnapshot(): CrisisSnapshot {
    return this.snapshot;
  }

  private computeIndicators(_now: number): CrisisIndicator[] {
    // now parameter kept for API compatibility but not currently used
    void _now;
    const needs = this.needsSystem.getAllNeeds();
    const totalAgents = needs.length || 1;

    let hungerStress = 0;
    let thirstStress = 0;
    let energyStress = 0;
    let emergencyCount = 0;

    for (const data of needs) {
      if (data.needs.hunger > 80) hungerStress++;
      if (data.needs.thirst > 80) thirstStress++;
      if (data.needs.energy < 25) energyStress++;
      if (data.emergencyLevel === "critical" || data.emergencyLevel === "dying") {
        emergencyCount++;
      }
    }

    const materials = this.gameState.resources?.materials;
    const totalFood = materials?.food ?? 0;
    const totalWater = materials?.water ?? 0;

    const sustainabilityValue = Math.min(1, (totalFood + totalWater) / Math.max(1, totalAgents * 10));
    const resourceBalance = Math.min(1, totalFood / Math.max(1, totalAgents * 5));
    const populationStress = Math.min(1, (hungerStress + thirstStress + energyStress) / (totalAgents * 3));
    const emergencyRate = Math.min(1, emergencyCount / totalAgents);

    const rawIndicators: Record<string, number> = {
      sustainability: 1 - sustainabilityValue,
      resource_balance: 1 - resourceBalance,
      population_stress: populationStress,
      emergency_rate: emergencyRate,
    };

    return Object.entries(rawIndicators).map(([name, value]) => {
      const config = INDICATOR_CONFIG[name];
      const severity = this.resolveSeverity(value, config.threshold);
      const trend = this.resolveTrend(name, value);
      this.pushHistory(name, value);

      return {
        name,
        value,
        threshold: config.threshold,
        severity,
        trend,
        description: config.description,
      } satisfies CrisisIndicator;
    });
  }

  private resolveSeverity(value: number, threshold: number): CrisisSeverity {
    if (value >= threshold * 2) return "critical";
    if (value >= threshold * 1.5) return "high";
    if (value >= threshold) return "medium";
    return "low";
  }

  private resolveTrend(name: string, _value: number): CrisisTrend {
    const history = this.indicatorHistory.get(name);
    if (!history || history.length < 5) return "stable";
    const recentAvg = history.slice(-3).reduce((acc, v) => acc + v, 0) / 3;
    const olderAvg = history.slice(-6, -3).reduce((acc, v) => acc + v, 0) / 3;
    if (recentAvg > olderAvg + 0.05) return "worsening";
    if (recentAvg < olderAvg - 0.05) return "improving";
    return "stable";
  }

  private pushHistory(name: string, value: number): void {
    if (!this.indicatorHistory.has(name)) {
      this.indicatorHistory.set(name, []);
    }
    const history = this.indicatorHistory.get(name)!;
    history.push(value);
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  private computePredictions(indicators: CrisisIndicator[], now: number): CrisisPrediction[] {
    const predictions: CrisisPrediction[] = [];

    const highIndicators = indicators.filter((ind) => ind.value >= ind.threshold);

    if (highIndicators.length === 0) {
      return predictions;
    }

    const addPrediction = (
      type: CrisisPrediction["type"],
      indicatorNames: string[],
      severity: number,
    ): void => {
      predictions.push({
        id: `${type}_${now}`,
        type,
        probability: Math.min(1, severity),
        timeToImpact: Math.max(15000, 60000 * (1 - severity)),
        severity,
        indicators: indicatorNames,
        recommendedActions: this.suggestActions(type),
        timestamp: now,
      });
    };

    const stressIndicator = indicators.find((ind) => ind.name === "population_stress");
    if (stressIndicator && stressIndicator.severity !== "low") {
      addPrediction("population_crisis", ["population_stress"], stressIndicator.value);
    }

    const balanceIndicator = indicators.find((ind) => ind.name === "resource_balance");
    if (balanceIndicator && balanceIndicator.severity !== "low") {
      addPrediction("resource_shortage", ["resource_balance"], balanceIndicator.value);
    }

    const sustainabilityIndicator = indicators.find((ind) => ind.name === "sustainability");
    const emergencyIndicator = indicators.find((ind) => ind.name === "emergency_rate");
    if (
      sustainabilityIndicator &&
      emergencyIndicator &&
      (sustainabilityIndicator.severity === "high" || emergencyIndicator.severity === "high")
    ) {
      addPrediction(
        "system_collapse",
        ["sustainability", "emergency_rate"],
        Math.max(sustainabilityIndicator.value, emergencyIndicator.value),
      );
    }

    return predictions;
  }

  private suggestActions(type: CrisisPrediction["type"]): string[] {
    switch (type) {
      case "resource_shortage":
        return ["Priorizar construcción de graneros", "Aumentar raciones de emergencia"];
      case "mass_starvation":
        return ["Distribuir reservas", "Activar mercados de intercambio"];
      case "population_crisis":
        return ["Reducir cargas de trabajo", "Abrir refugios temporales"];
      case "system_collapse":
      default:
        return ["Convocar consejo", "Activar protocolo de resiliencia"];
    }
  }
}
