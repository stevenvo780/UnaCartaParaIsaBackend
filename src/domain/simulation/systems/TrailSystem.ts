import { GameState } from "../../types/game-types";
import { logger } from "../../../infrastructure/utils/logger";
import { GameEventNames, simulationEvents } from "../core/events";

export interface TrailSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  intensity: number;
  lastUsed: number;
  purpose: "work" | "rest" | "trade" | "social" | "emergency" | "unknown";
  usageCount: number;
}

export interface HeatMapCell {
  x: number;
  y: number;
  heat: number;
  lastUpdate: number;
}

export class TrailSystem {
  private gameState: GameState;
  private enabled: boolean = true;

  private trails = new Map<string, TrailSegment>();
  private readonly GRID_SIZE = 32;

  private heatMap = new Map<string, HeatMapCell>();

  private config = {
    maxIntensity: 1.0,
    decayRate: 0.001,
    intensityIncrement: 0.1,
    minVisibleIntensity: 0.05,
    heatmapEnabled: true,
  };

  private stats = {
    totalTrails: 0,
    activeTrails: 0,
    hottestPath: "",
    averageIntensity: 0,
  };

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.setupEventListeners();
    logger.info("🛤️ TrailSystem initialized");
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventNames.MOVEMENT_ACTIVITY_STARTED,
      (data: {
        entityId: string;
        activityType: string;
        destination: { x: number; y: number };
        path?: Array<{ x: number; y: number }>;
      }) => {
        if (!this.enabled) return;
        this.recordMovement(data);
      },
    );

    simulationEvents.on(
      GameEventNames.MOVEMENT_ACTIVITY_COMPLETED,
      (data: { entityId: string; position: { x: number; y: number } }) => {
        if (!this.enabled) return;
        this.reinforceRecentTrails(data.entityId);
      },
    );
  }

  private recordMovement(data: {
    entityId: string;
    activityType: string;
    destination: { x: number; y: number };
    path?: Array<{ x: number; y: number }>;
  }): void {
    const purpose = this.determinePurpose(data.activityType);

    if (data.path && data.path.length > 1) {
      for (let i = 0; i < data.path.length - 1; i++) {
        const start = data.path[i];
        const end = data.path[i + 1];
        this.addTrailSegment(start, end, purpose);
      }
    } else {
      const agent = this.gameState.agents.find((a) => a.id === data.entityId);
      if (agent && agent.position) {
        this.addTrailSegment(agent.position, data.destination, purpose);
      }
    }

    if (data.destination) {
      this.updateHeatMap(data.destination.x, data.destination.y);
    }
  }

  private determinePurpose(
    activityType: string | undefined,
  ): TrailSegment["purpose"] {
    if (!activityType) return "unknown";

    const purposeMap: Record<string, TrailSegment["purpose"]> = {
      gather: "work",
      chop: "work",
      mine: "work",
      build: "work",
      sleep: "rest",
      eat: "rest",
      socialize: "social",
      trade: "trade",
      flee: "emergency",
      fight: "emergency",
      moving: "work", // Default moving to work if unspecified
    };

    return purposeMap[activityType.toLowerCase()] || "unknown";
  }

  private addTrailSegment(
    start: { x: number; y: number },
    end: { x: number; y: number },
    purpose: TrailSegment["purpose"],
  ): void {
    const segmentId = this.getSegmentId(start, end);

    const existing = this.trails.get(segmentId);
    if (existing) {
      existing.intensity = Math.min(
        this.config.maxIntensity,
        existing.intensity + this.config.intensityIncrement,
      );
      existing.lastUsed = Date.now();
      existing.usageCount++;

      if (purpose !== "unknown" && existing.purpose === "unknown") {
        existing.purpose = purpose;
      }
    } else {
      const segment: TrailSegment = {
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
        intensity: this.config.intensityIncrement,
        lastUsed: Date.now(),
        purpose,
        usageCount: 1,
      };

      this.trails.set(segmentId, segment);
      this.stats.totalTrails++;
    }
  }

  private getSegmentId(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): string {
    const sx = Math.round(start.x / this.GRID_SIZE) * this.GRID_SIZE;
    const sy = Math.round(start.y / this.GRID_SIZE) * this.GRID_SIZE;
    const ex = Math.round(end.x / this.GRID_SIZE) * this.GRID_SIZE;
    const ey = Math.round(end.y / this.GRID_SIZE) * this.GRID_SIZE;

    if (sx < ex || (sx === ex && sy < ey)) {
      return `${sx},${sy}-${ex},${ey}`;
    }
    return `${ex},${ey}-${sx},${sy}`;
  }

  private updateHeatMap(x: number, y: number): void {
    const cellX = Math.floor(x / this.GRID_SIZE);
    const cellY = Math.floor(y / this.GRID_SIZE);
    const cellId = `${cellX},${cellY}`;

    const existing = this.heatMap.get(cellId);
    if (existing) {
      existing.heat = Math.min(100, existing.heat + 5);
      existing.lastUpdate = Date.now();
    } else {
      this.heatMap.set(cellId, {
        x: cellX * this.GRID_SIZE,
        y: cellY * this.GRID_SIZE,
        heat: 5,
        lastUpdate: Date.now(),
      });
    }
  }

  private reinforceRecentTrails(_entityId: string): void {
    const now = Date.now();
    const recentThreshold = 5000;

    this.trails.forEach((trail) => {
      if (now - trail.lastUsed < recentThreshold) {
        trail.intensity = Math.min(
          this.config.maxIntensity,
          trail.intensity + this.config.intensityIncrement * 0.5,
        );
      }
    });
  }

  public update(deltaMs: number): void {
    if (!this.enabled) return;

    const deltaSeconds = deltaMs / 1000;
    const now = Date.now();

    let activeCount = 0;
    let totalIntensity = 0;
    let hottestIntensity = 0;
    let hottestId = "";

    this.trails.forEach((trail, id) => {
      const timeSinceUse = (now - trail.lastUsed) / 1000;
      const decayAmount =
        this.config.decayRate * deltaSeconds * (1 + timeSinceUse / 60);

      trail.intensity = Math.max(0, trail.intensity - decayAmount);

      if (trail.intensity > this.config.minVisibleIntensity) {
        activeCount++;
        totalIntensity += trail.intensity;

        if (trail.intensity > hottestIntensity) {
          hottestIntensity = trail.intensity;
          hottestId = id;
        }
      } else if (trail.intensity === 0) {
        this.trails.delete(id);
      }
    });

    this.heatMap.forEach((cell, id) => {
      const timeSinceUpdate = (now - cell.lastUpdate) / 1000;
      const decayAmount = 0.5 * deltaSeconds * (1 + timeSinceUpdate / 30);

      cell.heat = Math.max(0, cell.heat - decayAmount);

      if (cell.heat === 0) {
        this.heatMap.delete(id);
      }
    });

    this.stats.activeTrails = activeCount;
    this.stats.averageIntensity =
      activeCount > 0 ? totalIntensity / activeCount : 0;
    this.stats.hottestPath = hottestId;
  }

  public getStats(): {
    totalTrails: number;
    activeTrails: number;
    hottestPath: string;
    averageIntensity: number;
    totalCells: number;
  } {
    return { ...this.stats, totalCells: this.heatMap.size };
  }

  public getTrafficHotspots(topN: number = 5): HeatMapCell[] {
    const cells = Array.from(this.heatMap.values());
    return cells.sort((a, b) => b.heat - a.heat).slice(0, topN);
  }

  public getMostUsedTrails(topN: number = 5): TrailSegment[] {
    const trails = Array.from(this.trails.values());
    return trails.sort((a, b) => b.usageCount - a.usageCount).slice(0, topN);
  }

  public getAllTrails(): TrailSegment[] {
    return Array.from(this.trails.values());
  }
}
