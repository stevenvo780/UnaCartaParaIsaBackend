import type { GameState, Zone } from "../../types/game-types.js";
import { simulationEvents, GameEventNames } from "../events.js";
import { ResourceReservationSystem } from "./ResourceReservationSystem.js";
import {
  BUILDING_COSTS,
  BuildingLabel,
} from "../types/buildings.js";

interface BuildingSystemConfig {
  decisionIntervalMs: number;
  maxHouses: number;
  maxMines: number;
  maxWorkbenches: number;
}

interface ConstructionJob {
  id: string;
  zoneId: string;
  label: BuildingLabel;
  completesAt: number;
  reservationId: string;
}

const DEFAULT_CONFIG: BuildingSystemConfig = {
  decisionIntervalMs: 7_000,
  maxHouses: 8,
  maxMines: 4,
  maxWorkbenches: 3,
};

type MutableZone = Zone & {
  metadata?: Record<string, unknown> & {
    building?: string;
    underConstruction?: boolean;
    craftingStation?: boolean;
  };
  durability?: number;
  maxDurability?: number;
};

export class BuildingSystem {
  private readonly config: BuildingSystemConfig;
  private readonly now: () => number;
  private readonly constructionJobs = new Map<string, ConstructionJob>();
  private lastDecisionAt = 0;

  constructor(
    private readonly state: GameState,
    private readonly reservationSystem: ResourceReservationSystem,
    config?: Partial<BuildingSystemConfig>,
    nowProvider: () => number = () => Date.now(),
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.now = nowProvider;
  }

  public update(_deltaMs: number): void {
    const now = this.now();
    this.completeFinishedJobs(now);

    if (now - this.lastDecisionAt < this.config.decisionIntervalMs) {
      return;
    }

    this.lastDecisionAt = now;
    const candidate = this.pickNextConstruction();
    if (candidate) {
      this.tryScheduleConstruction(candidate, now);
    }
  }

  private pickNextConstruction(): BuildingLabel | null {
    const zones = (this.state.zones || []) as MutableZone[];
    const houses = zones.filter((z) => z.type === "rest").length;
    if (houses < this.config.maxHouses && !this.hasActiveJob("house")) {
      return "house";
    }

    const mines = zones.filter(
      (z) => z.metadata?.building === "mine" && z.metadata?.underConstruction !== true,
    ).length;
    if (mines < this.config.maxMines && !this.hasActiveJob("mine")) {
      return "mine";
    }

    const workbenches = zones.filter((z) => z.metadata?.craftingStation === true).length;
    if (workbenches < this.config.maxWorkbenches && !this.hasActiveJob("workbench")) {
      return "workbench";
    }

    return null;
  }

  private hasActiveJob(label: BuildingLabel): boolean {
    for (const job of Array.from(this.constructionJobs.values())) {
      if (job.label === label) return true;
    }
    return false;
  }

  private tryScheduleConstruction(label: BuildingLabel, now: number): boolean {
    const cost = BUILDING_COSTS[label];
    const reservationId = `build_${label}_${now}_${Math.random().toString(36).slice(2)}`;

    const reserved = this.reservationSystem.reserve(reservationId, {
      wood: cost.wood,
      stone: cost.stone,
    });
    if (!reserved) {
      return false;
    }

    const zone = this.createConstructionZone(label);
    const mutableZone = zone as MutableZone;
    (this.state.zones as MutableZone[]).push(mutableZone);

    const job: ConstructionJob = {
      id: reservationId,
      zoneId: mutableZone.id,
      label,
      reservationId,
      completesAt: now + cost.time,
    };

    this.constructionJobs.set(job.id, job);

    simulationEvents.emit(GameEventNames.BUILDING_CONSTRUCTION_STARTED, {
      jobId: job.id,
      zoneId: job.zoneId,
      label: job.label,
      completesAt: job.completesAt,
    });

    return true;
  }

  private createConstructionZone(label: BuildingLabel): MutableZone {
    const worldSize = this.state.worldSize ?? { width: 2000, height: 2000 };
    const zoneId = `zone_${label}_${Math.random().toString(36).slice(2)}`;
    const metadata: MutableZone["metadata"] = {
      building: label,
      underConstruction: true,
      craftingStation: label === "workbench",
    };

    return {
      id: zoneId,
      type: "work",
      bounds: {
        x: Math.floor(Math.random() * worldSize.width),
        y: Math.floor(Math.random() * worldSize.height),
        width: 120,
        height: 80,
      },
      props: {
        color: "#C4B998",
        status: "construction",
      },
      metadata,
      durability: 10,
      maxDurability: 100,
    } as MutableZone;
  }

  private completeFinishedJobs(now: number): void {
    for (const job of Array.from(this.constructionJobs.values())) {
      if (now < job.completesAt) continue;
      this.finalizeConstruction(job, now);
    }
  }

  private finalizeConstruction(job: ConstructionJob, completedAt: number): void {
    this.constructionJobs.delete(job.id);

    const consumed = this.reservationSystem.consume(job.reservationId);
    if (!consumed) {
      // Refund reservation if consumption fails
      this.reservationSystem.release(job.reservationId);
    }

    const zones = (this.state.zones || []) as MutableZone[];
    const zone = zones.find((z) => z.id === job.zoneId);
    if (!zone) {
      return;
    }

    if (!zone.metadata) {
      zone.metadata = {};
    }

    zone.metadata.underConstruction = false;
    zone.metadata.building = job.label === "mine" ? "mine" : job.label;
    zone.metadata.craftingStation = job.label === "workbench";
    zone.type = job.label === "house" ? "rest" : "work";
    zone.props = {
      ...(zone.props || {}),
      status: "ready",
    };
    zone.durability = 100;
    zone.maxDurability = 100;

    simulationEvents.emit(GameEventNames.BUILDING_CONSTRUCTED, {
      jobId: job.id,
      zoneId: job.zoneId,
      label: job.label,
      completedAt,
    });
  }
}
