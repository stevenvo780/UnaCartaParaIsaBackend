import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type {
  CrisisIndicator,
  CrisisPrediction,
  CrisisSnapshot,
} from "../../types/simulation/ambient";
import {
  CrisisSeverity,
  CrisisTrend,
  CrisisPredictionType,
} from "../../../shared/constants/AmbientEnums";
import { simulationEvents, GameEventNames } from "../core/events";

const INDICATOR_CONFIG: Record<
  string,
  { threshold: number; description: string }
> = {
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

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class CrisisPredictorSystem {
  private snapshot: CrisisSnapshot;
  private indicatorHistory = new Map<string, number[]>();
  private readonly MAX_HISTORY = 60;
  private previousPredictions = new Map<string, CrisisPrediction>();

  constructor(
    @inject(TYPES.GameState) private readonly gameState: GameState,
    @inject(TYPES.NeedsSystem) private readonly needsSystem: NeedsSystem,
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
      historySize:
        Math.min(
          ...Array.from(this.indicatorHistory.values()).map(
            (values) => values.length,
          ),
        ) || 0,
      lastUpdated: now,
    };

    this.gameState.crisisForecast = this.snapshot;

    this.emitPredictionEvents(predictions);
  }

  private emitPredictionEvents(predictions: CrisisPrediction[]): void {
    const currentPredictionIds = new Set(predictions.map((p) => p.id));

    for (const prediction of predictions) {
      const previous = this.previousPredictions.get(prediction.id);

      if (!previous) {
        if (prediction.probability >= 0.7) {
          simulationEvents.emit(GameEventNames.CRISIS_IMMEDIATE_WARNING, {
            prediction,
            timestamp: Date.now(),
          });
        } else {
          simulationEvents.emit(GameEventNames.CRISIS_PREDICTION, {
            prediction,
            timestamp: Date.now(),
          });
        }
      } else if (prediction.probability > previous.probability + 0.1) {
        if (prediction.probability >= 0.7) {
          simulationEvents.emit(GameEventNames.CRISIS_IMMEDIATE_WARNING, {
            prediction,
            previousProbability: previous.probability,
            timestamp: Date.now(),
          });
        }
      }

      this.previousPredictions.set(prediction.id, prediction);
    }

    for (const [id] of this.previousPredictions.entries()) {
      if (!currentPredictionIds.has(id)) {
        this.previousPredictions.delete(id);
      }
    }
  }

  public getSnapshot(): CrisisSnapshot {
    return this.snapshot;
  }

  private computeIndicators(_now: number): CrisisIndicator[] {
    void _now;
    const needs = this.needsSystem.getAllNeeds();
    const totalAgents = needs.size || 1;

    let hungerStress = 0;
    let thirstStress = 0;
    let energyStress = 0;
    let criticalCount = 0;

    for (const [, data] of needs) {
      if (data.hunger > 80) hungerStress++;
      if (data.thirst > 80) thirstStress++;
      if (data.energy < 25) energyStress++;

      if (data.hunger > 90 || data.thirst > 90) {
        criticalCount++;
      }
    }

    const materials = this.gameState.resources?.materials;
    const totalFood = materials?.food ?? 0;
    const totalWater = materials?.water ?? 0;

    const sustainabilityValue = Math.min(
      1,
      (totalFood + totalWater) / Math.max(1, totalAgents * 10),
    );
    const resourceBalance = Math.min(
      1,
      totalFood / Math.max(1, totalAgents * 5),
    );
    const populationStress = Math.min(
      1,
      (hungerStress + thirstStress + energyStress) / (totalAgents * 3),
    );
    const emergencyRate = Math.min(1, criticalCount / totalAgents);

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
    if (value >= threshold * 2) return CrisisSeverity.CRITICAL;
    if (value >= threshold * 1.5) return CrisisSeverity.HIGH;
    if (value >= threshold) return CrisisSeverity.MEDIUM;
    return CrisisSeverity.LOW;
  }

  private resolveTrend(name: string, _value: number): CrisisTrend {
    const history = this.indicatorHistory.get(name);
    if (!history || history.length < 5) return CrisisTrend.STABLE;
    const recentAvg = history.slice(-3).reduce((acc, v) => acc + v, 0) / 3;
    const olderAvg = history.slice(-6, -3).reduce((acc, v) => acc + v, 0) / 3;
    if (recentAvg > olderAvg + 0.05) return CrisisTrend.WORSENING;
    if (recentAvg < olderAvg - 0.05) return CrisisTrend.IMPROVING;
    return CrisisTrend.STABLE;
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

  private computePredictions(
    indicators: CrisisIndicator[],
    now: number,
  ): CrisisPrediction[] {
    const predictions: CrisisPrediction[] = [];

    const highIndicators = indicators.filter(
      (ind) => ind.value >= ind.threshold,
    );

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

    const stressIndicator = indicators.find(
      (ind) => ind.name === "population_stress",
    );
    if (stressIndicator && stressIndicator.severity !== CrisisSeverity.LOW) {
      addPrediction(
        CrisisPredictionType.POPULATION_CRISIS,
        ["population_stress"],
        stressIndicator.value,
      );
    }

    const balanceIndicator = indicators.find(
      (ind) => ind.name === "resource_balance",
    );
    if (balanceIndicator && balanceIndicator.severity !== CrisisSeverity.LOW) {
      addPrediction(
        CrisisPredictionType.RESOURCE_SHORTAGE,
        ["resource_balance"],
        balanceIndicator.value,
      );
    }

    const sustainabilityIndicator = indicators.find(
      (ind) => ind.name === "sustainability",
    );
    const emergencyIndicator = indicators.find(
      (ind) => ind.name === "emergency_rate",
    );
    if (
      sustainabilityIndicator &&
      emergencyIndicator &&
      (sustainabilityIndicator.severity === CrisisSeverity.HIGH ||
        emergencyIndicator.severity === CrisisSeverity.HIGH)
    ) {
      addPrediction(
        CrisisPredictionType.SYSTEM_COLLAPSE,
        ["sustainability", "emergency_rate"],
        Math.max(sustainabilityIndicator.value, emergencyIndicator.value),
      );
    }

    return predictions;
  }

  private suggestActions(type: CrisisPrediction["type"]): string[] {
    switch (type) {
      case CrisisPredictionType.RESOURCE_SHORTAGE:
        return [
          "Priorizar construcción de graneros",
          "Aumentar raciones de emergencia",
        ];
      case CrisisPredictionType.MASS_STARVATION:
        return ["Distribuir reservas", "Activar mercados de intercambio"];
      case CrisisPredictionType.POPULATION_CRISIS:
        return ["Reducir cargas de trabajo", "Abrir refugios temporales"];
      case CrisisPredictionType.SYSTEM_COLLAPSE:
      default:
        return ["Convocar consejo", "Activar protocolo de resiliencia"];
    }
  }
}
