import { EventEmitter } from "node:events";
import type { GameState } from "../../types/game-types.js";
import { simulationEvents, GameEventNames } from "../core/events";
import type { NeedsSystem } from "./NeedsSystem.js";
import type { SocialSystem } from "./SocialSystem.js";
import type { LifeCycleSystem } from "./LifeCycleSystem.js";
import type { EconomySystem } from "./EconomySystem.js";

export interface EmergencePattern {
  id: string;
  name: string;
  description: string;
  type: "behavioral" | "social" | "environmental" | "systemic";
  strength: number;
  duration: number;
  triggers: string[];
  intensity?: number;
  participants?: string[];
  effects: {
    needsModifiers?: Record<string, number>;
    aiModifiers?: Record<string, unknown>;
    worldModifiers?: Record<string, number>;
  };
  conditions: {
    minResonance?: number;
    maxResonance?: number;
    timeOfDay?: string[];
    weatherConditions?: string[];
    entityStates?: Array<{
      entity: string;
      needs: Record<string, { min?: number; max?: number }>;
    }>;
  };
}

export interface FeedbackLoop {
  id: string;
  type: "positive" | "negative";
  strength: number;
  elements: string[];
  description: string;
  active: boolean;
}

export interface EmergenceMetrics {
  cohesion: number;
  novelty: number;
  stability: number;
  complexity: number;
  coherence: number;
  adaptability: number;
  sustainability: number;
  entropy: number;
  autopoiesis: number;
  timestamp: number;
}

interface EmergenceConfig {
  evaluationIntervalMs: number;
  patternMinStrength: number;
  patternMaxDuration: number;
  historySize: number;
}

const DEFAULT_CONFIG: EmergenceConfig = {
  evaluationIntervalMs: 5000,
  patternMinStrength: 0.3,
  patternMaxDuration: 60000,
  historySize: 100,
};

export class EmergenceSystem extends EventEmitter {
  private gameState: GameState;
  private config: EmergenceConfig;
  private patterns = new Map<string, EmergencePattern>();
  private feedbackLoops = new Map<string, FeedbackLoop>();
  private metricsHistory: EmergenceMetrics[] = [];
  private lastEvaluation = 0;
  private currentMetrics: EmergenceMetrics;

  private needsSystem?: NeedsSystem;
  private socialSystem?: SocialSystem;
  private lifeCycleSystem?: LifeCycleSystem;
  private economySystem?: EconomySystem;

  constructor(
    gameState: GameState,
    config?: Partial<EmergenceConfig>,
    systems?: {
      needsSystem?: NeedsSystem;
      socialSystem?: SocialSystem;
      lifeCycleSystem?: LifeCycleSystem;
      economySystem?: EconomySystem;
    },
  ) {
    super();
    this.gameState = gameState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.needsSystem = systems?.needsSystem;
    this.socialSystem = systems?.socialSystem;
    this.lifeCycleSystem = systems?.lifeCycleSystem;
    this.economySystem = systems?.economySystem;

    this.currentMetrics = this.createInitialMetrics();
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastEvaluation >= this.config.evaluationIntervalMs) {
      this.evaluatePatterns();
      this.updateFeedbackLoops();
      this.computeMetrics();
      this.lastEvaluation = now;
    }

    // Cleanup expired patterns
    this.cleanupExpiredPatterns();
  }

  private createInitialMetrics(): EmergenceMetrics {
    return {
      cohesion: 0.5,
      novelty: 0.3,
      stability: 0.7,
      complexity: 0.4,
      coherence: 0.6,
      adaptability: 0.5,
      sustainability: 0.6,
      entropy: 0.3,
      autopoiesis: 0.4,
      timestamp: Date.now(),
    };
  }

  private evaluatePatterns(): void {
    const newPatterns: EmergencePattern[] = [];

    // Detect social patterns
    if (this.socialSystem) {
      const socialPattern = this.detectSocialPattern();
      if (socialPattern) newPatterns.push(socialPattern);
    }

    // Detect economic patterns
    if (this.economySystem) {
      const economicPattern = this.detectEconomicPattern();
      if (economicPattern) newPatterns.push(economicPattern);
    }

    // Detect population patterns
    if (this.lifeCycleSystem) {
      const populationPattern = this.detectPopulationPattern();
      if (populationPattern) newPatterns.push(populationPattern);
    }

    // Detect needs-based patterns
    if (this.needsSystem) {
      const needsPattern = this.detectNeedsPattern();
      if (needsPattern) newPatterns.push(needsPattern);
    }

    // Register new patterns
    for (const pattern of newPatterns) {
      if (pattern.strength >= this.config.patternMinStrength) {
        this.patterns.set(pattern.id, pattern);
        simulationEvents.emit(GameEventNames.EMERGENCE_PATTERN_DETECTED, {
          pattern: pattern.id,
          strength: pattern.strength,
          data: pattern,
        });
      }
    }
  }

  private detectSocialPattern(): EmergencePattern | null {
    if (!this.socialSystem) return null;

    const entities = this.gameState.entities || [];
    if (entities.length < 3) return null;

    // Detect clustering pattern (agents gathering in groups)
    const positions = entities
      .map((e) => e.position)
      .filter((p): p is { x: number; y: number } => p !== undefined);
    const clusters = this.detectClusters(positions, 200);

    if (clusters.length >= 2 && clusters.length < entities.length / 2) {
      return {
        id: `social_clustering_${Date.now()}`,
        name: "Social Clustering",
        description: "Agents are forming social clusters",
        type: "social",
        strength: Math.min(0.8, clusters.length / entities.length),
        duration: 30000,
        triggers: ["proximity", "social_interaction"],
        participants: entities
          .slice(0, Math.min(5, entities.length))
          .map((e) => e.id),
        effects: {
          needsModifiers: {
            loneliness: -0.1,
            happiness: 0.05,
          },
        },
        conditions: {},
      };
    }

    return null;
  }

  private detectEconomicPattern(): EmergencePattern | null {
    if (!this.economySystem) return null;

    const resources = this.gameState.resources?.materials || {};
    const totalResources = Object.values(resources).reduce(
      (a, b) => a + (b || 0),
      0,
    );

    // Detect resource accumulation pattern
    if (totalResources > 1000) {
      return {
        id: `economic_accumulation_${Date.now()}`,
        name: "Resource Accumulation",
        description: "Significant resource accumulation detected",
        type: "systemic",
        strength: Math.min(0.9, totalResources / 5000),
        duration: 60000,
        triggers: ["resource_gathering", "production"],
        effects: {
          worldModifiers: {
            stability: 0.1,
          },
        },
        conditions: {},
      };
    }

    return null;
  }

  private detectPopulationPattern(): EmergencePattern | null {
    if (!this.lifeCycleSystem) return null;

    const entities = this.gameState.entities || [];
    const birthRate = entities.filter((e) => {
      const birthTimestamp =
        typeof e.stats?.birthTimestamp === "number"
          ? e.stats.birthTimestamp
          : 0;
      const age = (Date.now() - birthTimestamp) / (365 * 24 * 60 * 60 * 1000);
      return age < 1;
    }).length;

    if (birthRate > 0 && entities.length > 5) {
      return {
        id: `population_growth_${Date.now()}`,
        name: "Population Growth",
        description: "Population is growing",
        type: "systemic",
        strength: Math.min(0.7, birthRate / entities.length),
        duration: 120000,
        triggers: ["birth", "reproduction"],
        effects: {
          worldModifiers: {
            complexity: 0.05,
            sustainability: 0.02,
          },
        },
        conditions: {},
      };
    }

    return null;
  }

  private detectNeedsPattern(): EmergencePattern | null {
    if (!this.needsSystem) return null;

    const allNeeds = this.needsSystem.getAllNeeds();
    const allNeedsValues = Array.from(allNeeds.values());
    if (allNeedsValues.length === 0) return null;

    const criticalCount = allNeedsValues.filter((n) => {
      const needs = n.needs;
      return needs.hunger > 80 || needs.thirst > 80 || needs.energy < 20;
    }).length;

    const criticalRatio = criticalCount / allNeedsValues.length;

    if (criticalRatio > 0.3) {
      return {
        id: `needs_crisis_${Date.now()}`,
        name: "Needs Crisis",
        description: "High number of agents with critical needs",
        type: "behavioral",
        strength: Math.min(0.9, criticalRatio),
        duration: 45000,
        triggers: ["needs_depletion", "resource_scarcity"],
        effects: {
          needsModifiers: {
            stress: 0.15,
            mentalHealth: -0.1,
          },
          aiModifiers: {
            priority: "survival",
          },
        },
        conditions: {},
      };
    }

    return null;
  }

  private detectClusters(
    positions: Array<{ x: number; y: number }>,
    threshold: number,
  ): Array<Array<{ x: number; y: number }>> {
    const clusters: Array<Array<{ x: number; y: number }>> = [];
    const visited = new Set<number>();

    for (let i = 0; i < positions.length; i++) {
      if (visited.has(i)) continue;

      const cluster: Array<{ x: number; y: number }> = [positions[i]];
      visited.add(i);

      for (let j = i + 1; j < positions.length; j++) {
        if (visited.has(j)) continue;

        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < threshold) {
          cluster.push(positions[j]);
          visited.add(j);
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private updateFeedbackLoops(): void {
    // Detect positive feedback loops (e.g., resource gathering -> more production -> more resources)
    const resources = this.gameState.resources?.materials || {};
    const totalResources = Object.values(resources).reduce(
      (a, b) => a + (b || 0),
      0,
    );

    if (
      totalResources > 500 &&
      !this.feedbackLoops.has("resource_production_loop")
    ) {
      this.feedbackLoops.set("resource_production_loop", {
        id: "resource_production_loop",
        type: "positive",
        strength: 0.6,
        elements: ["resource_gathering", "production", "resource_accumulation"],
        description:
          "Resources enable production which generates more resources",
        active: true,
      });
    }

    // Detect negative feedback loops (e.g., population growth -> resource depletion -> population decline)
    const entities = this.gameState.entities || [];
    if (entities.length > 10 && totalResources < 200) {
      if (!this.feedbackLoops.has("population_resource_loop")) {
        this.feedbackLoops.set("population_resource_loop", {
          id: "population_resource_loop",
          type: "negative",
          strength: 0.5,
          elements: [
            "population_growth",
            "resource_depletion",
            "population_stress",
          ],
          description: "Population growth depletes resources causing stress",
          active: true,
        });
      }
    }
  }

  private computeMetrics(): void {
    const entities = this.gameState.entities || [];
    const entityCount = entities.length;

    // Cohesion: how connected the system is
    const cohesion = this.socialSystem ? Math.min(1.0, entityCount / 20) : 0.5;

    // Novelty: how much new activity is happening
    const novelty =
      this.patterns.size > 0 ? Math.min(1.0, this.patterns.size / 5) : 0.3;

    // Stability: how stable the system state is
    const needs = this.needsSystem?.getAllNeeds() || [];
    const avgNeeds =
      needs.length > 0
        ? needs.reduce((sum, n) => {
          const nv = n.needs;
          return sum + (nv.hunger + nv.thirst + nv.energy + nv.hygiene) / 4;
        }, 0) / needs.length
        : 50;
    const stability = 1.0 - Math.abs(avgNeeds - 50) / 50;

    // Complexity: system complexity based on interactions
    const complexity = Math.min(1.0, (entityCount + this.patterns.size) / 30);

    // Coherence: how well systems work together
    const coherence = (cohesion + stability) / 2;

    // Adaptability: system's ability to adapt
    const adaptability = (novelty + stability) / 2;

    // Sustainability: long-term viability
    const resources = this.gameState.resources?.materials || {};
    const totalResources = Object.values(resources).reduce(
      (a, b) => a + (b || 0),
      0,
    );
    const sustainability = Math.min(1.0, totalResources / 1000);

    // Entropy: disorder in the system
    const entropy = 1.0 - stability;

    // Autopoiesis: self-organization capability
    const autopoiesis = (cohesion + adaptability) / 2;

    this.currentMetrics = {
      cohesion,
      novelty,
      stability,
      complexity,
      coherence,
      adaptability,
      sustainability,
      entropy,
      autopoiesis,
      timestamp: Date.now(),
    };

    this.metricsHistory.push({ ...this.currentMetrics });
    if (this.metricsHistory.length > this.config.historySize) {
      this.metricsHistory.shift();
    }

    // Emit metrics update
    simulationEvents.emit(GameEventNames.EMERGENCE_METRICS_UPDATED, {
      metrics: this.currentMetrics,
      patterns: Array.from(this.patterns.values()),
      feedbackLoops: Array.from(this.feedbackLoops.values()),
    });
  }

  private cleanupExpiredPatterns(): void {
    const now = Date.now();
    for (const [id, pattern] of Array.from(this.patterns.entries())) {
      if (now - pattern.duration > pattern.duration) {
        this.patterns.delete(id);
      }
    }
  }

  public getSystemMetrics(): EmergenceMetrics {
    return { ...this.currentMetrics };
  }

  public getActivePatterns(): EmergencePattern[] {
    return Array.from(this.patterns.values());
  }

  public getActiveFeedbackLoops(): FeedbackLoop[] {
    return Array.from(this.feedbackLoops.values());
  }

  public getMetricsHistory(): EmergenceMetrics[] {
    return [...this.metricsHistory];
  }

  public forcePatternEvaluation(): void {
    this.evaluatePatterns();
    this.updateFeedbackLoops();
    this.computeMetrics();
  }

  public getStats(): Record<string, unknown> {
    return {
      totalPatterns: this.patterns.size,
      activeFeedbackLoops: this.feedbackLoops.size,
      lastEvaluation: this.lastEvaluation,
      metrics: this.currentMetrics,
    };
  }

  public getSystemStats(): Record<string, unknown> {
    return {
      metrics: this.getSystemMetrics(),
      stats: this.getStats(),
      activePatterns: this.getActivePatterns(),
      feedbackLoops: this.getActiveFeedbackLoops(),
      complexity: this.currentMetrics.complexity,
      coherence: this.currentMetrics.coherence,
      adaptability: this.currentMetrics.adaptability,
      sustainability: this.currentMetrics.sustainability,
      entropy: this.currentMetrics.entropy,
      autopoiesis: this.currentMetrics.autopoiesis,
      patterns: this.getActivePatterns(),
    };
  }
}
