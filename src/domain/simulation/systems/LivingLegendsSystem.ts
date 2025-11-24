import { GameEventNames, simulationEvents } from "../core/events";
import type { GameState } from "../../types/game-types";
import type {
  LegendRecord,
  ReputationEvent,
  LegendDeed,
} from "../../types/simulation/legends";

export class LivingLegendsSystem {
  // @ts-ignore - Kept for potential future use
  private _state: GameState;
  private legends = new Map<string, LegendRecord>();
  private reputationEvents: ReputationEvent[] = [];
  private readonly MAX_EVENT_HISTORY = 50;
  private lastTitleUpdate = 0;

  private config = {
    minReputationForLegend: 0.7,
    minReputationForVillain: -0.5,
    storyGenerationThreshold: 0.2,
    auraEnabled: true,
    rumorsSpreadRate: 0.1,
    titleUpdateInterval: 5000,
  };

  constructor(state: GameState) {
    // State kept for potential future use
    this._state = state;
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
      data.delta > 0 ? "rising" : data.delta < 0 ? "falling" : "stable";
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
    // Placeholder for title update logic
  }

  private createLegendRecord(agentId: string): LegendRecord {
    return {
      agentId,
      agentName: "Unknown", // Should fetch name from state
      reputation: 0,
      reputationTrend: "stable",
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
}
