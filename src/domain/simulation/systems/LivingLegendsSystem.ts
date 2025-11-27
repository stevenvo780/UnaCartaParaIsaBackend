import { GameEventNames, simulationEvents } from "../core/events";
import type { GameState } from "../../types/game-types";
import type {
  LegendRecord,
  ReputationEvent,
  LegendDeed,
} from "../../types/simulation/legends";
import { LegendTrend } from "../../../shared/constants/LegendEnums";

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { AgentRegistry } from "../core/AgentRegistry";

@injectable()
export class LivingLegendsSystem {
  private _state: GameState;
  private legends = new Map<string, LegendRecord>();
  private reputationEvents: ReputationEvent[] = [];
  private readonly MAX_EVENT_HISTORY = 50;
  private lastTitleUpdate = 0;
  private agentRegistry?: AgentRegistry;

  private config = {
    minReputationForLegend: 0.7,
    minReputationForVillain: -0.5,
    storyGenerationThreshold: 0.2,
    auraEnabled: true,
    rumorsSpreadRate: 0.1,
    titleUpdateInterval: 5000,
  };

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.AgentRegistry) @optional() agentRegistry?: AgentRegistry,
  ) {
    this._state = state;
    this.agentRegistry = agentRegistry;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventNames.REPUTATION_UPDATED,
      this.handleReputationChange.bind(this),
    );
    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      this.recordDeed.bind(this),
    );
  }

  public update(delta: number): void {
    this.lastTitleUpdate += delta;
    if (this.lastTitleUpdate >= this.config.titleUpdateInterval) {
      this.lastTitleUpdate = 0;
      this.updateTitles();
    }

    if (!this._state.legends) {
      this._state.legends = {
        records: new Map(),
        activeLegends: [],
      };
    }

    this._state.legends.records = this.legends;
    this._state.legends.activeLegends = this.getActiveLegends();
  }

  private handleReputationChange(data: {
    entityId: string;
    newReputation: number;
    delta: number;
    reason?: string;
  }): void {
    const oldRep = this.legends.get(data.entityId)?.reputation ?? 0;

    const event: ReputationEvent = {
      agentId: data.entityId,
      oldRep,
      newRep: data.newReputation,
      delta: data.delta,
      reason: data.reason || "unknown",
      timestamp: Date.now(),
    };

    this.reputationEvents.push(event);
    if (this.reputationEvents.length > this.MAX_EVENT_HISTORY) {
      this.reputationEvents.shift();
    }

    let legend = this.legends.get(data.entityId);
    if (!legend) {
      legend = this.createLegendRecord(data.entityId);
      this.legends.set(data.entityId, legend);
    }

    legend.reputation = data.newReputation;
    legend.reputationTrend =
      data.delta > 0
        ? LegendTrend.RISING
        : data.delta < 0
          ? LegendTrend.FALLING
          : LegendTrend.STABLE;
    legend.lastUpdate = Date.now();

    simulationEvents.emit(GameEventNames.LEGEND_UPDATE, { legend });
  }

  private recordDeed(data: {
    agentId: string;
    actionType: string;
    success: boolean;
    impact?: number;
  }): void {
    if (!data.success) return;

    let legend = this.legends.get(data.agentId);
    if (!legend) {
      legend = this.createLegendRecord(data.agentId);
      this.legends.set(data.agentId, legend);
    }

    const deed: LegendDeed = {
      id: Math.random().toString(36).substr(2, 9),
      type: "neutral", // Logic to determine type needed
      description: `Performed ${data.actionType}`,
      impact: data.impact ?? 1,
      timestamp: Date.now(),
      witnesses: [],
    };

    legend.deeds.push(deed);
    legend.lastUpdate = Date.now();
  }

  private updateTitles(): void {
    for (const [agentId, legend] of Array.from(this.legends.entries())) {
      const agent =
        this.agentRegistry?.getProfile(agentId) ??
        this._state.agents?.find((a) => a.id === agentId);
      if (!agent) continue;

      const newTitles: string[] = [];
      let newTier: LegendRecord["legendTier"] = "unknown";

      if (legend.reputation >= 0.9) {
        newTier = "mythical";
        newTitles.push("Mythical Being");
      } else if (legend.reputation >= 0.8) {
        newTier = "legendary";
        newTitles.push("Legend");
      } else if (legend.reputation >= 0.7) {
        newTier = "renowned";
        newTitles.push("Renowned");
      } else if (legend.reputation >= 0.5) {
        newTier = "respected";
        newTitles.push("Respected");
      } else if (legend.reputation >= 0.2) {
        newTier = "known";
        newTitles.push("Known");
      } else if (legend.reputation <= -0.5) {
        newTier = "unknown";
        newTitles.push("Villain");
      }

      if (legend.deeds.length >= 10) {
        newTitles.push("Accomplished");
      }
      if (legend.deeds.length >= 20) {
        newTitles.push("Hero");
      }

      legend.titles = newTitles;
      legend.currentTitle = newTitles[0] || "";
      legend.legendTier = newTier;

      if (newTier === "mythical" || newTier === "legendary") {
        legend.auraColor = 0xffdd00;
        legend.auraIntensity = 0.8;
        legend.glowRadius = 50;
      } else if (newTier === "renowned") {
        legend.auraColor = 0x00ddff;
        legend.auraIntensity = 0.6;
        legend.glowRadius = 35;
      } else if (newTier === "respected") {
        legend.auraColor = 0x88ff88;
        legend.auraIntensity = 0.4;
        legend.glowRadius = 25;
      } else if (legend.reputation <= -0.5) {
        legend.auraColor = 0xff0000;
        legend.auraIntensity = 0.5;
        legend.glowRadius = 30;
      } else {
        legend.auraIntensity = 0;
        legend.glowRadius = 0;
      }
    }
  }

  private createLegendRecord(agentId: string): LegendRecord {
    const agent =
      this.agentRegistry?.getProfile(agentId) ??
      this._state.agents?.find((a) => a.id === agentId);
    const agentName = agent?.name || "Unknown";

    return {
      agentId,
      agentName,
      reputation: 0,
      reputationTrend: LegendTrend.STABLE,
      titles: [],
      currentTitle: "",
      deeds: [],
      actionsCompleted: new Map(),
      relationshipCount: 0,
      auraColor: 0xffffff,
      auraIntensity: 0,
      glowRadius: 0,
      stories: [],
      legendTier: "unknown",
      firstSeen: Date.now(),
      lastUpdate: Date.now(),
    };
  }

  /**
   * Get legend record for a specific agent
   */
  public getLegend(agentId: string): LegendRecord | undefined {
    return this.legends.get(agentId);
  }

  /**
   * Get all legend records
   */
  public getAllLegends(): Map<string, LegendRecord> {
    return new Map(this.legends);
  }

  /**
   * Get active legends (those with significant reputation)
   */
  public getActiveLegends(): string[] {
    const active: string[] = [];
    for (const [agentId, legend] of Array.from(this.legends.entries())) {
      if (
        legend.reputation >= this.config.minReputationForLegend ||
        legend.reputation <= this.config.minReputationForVillain
      ) {
        active.push(agentId);
      }
    }
    return active;
  }
}
