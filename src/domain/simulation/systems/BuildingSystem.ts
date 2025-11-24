import type { GameState, Zone } from "../../types/game-types";
import { simulationEvents, GameEventNames } from "../core/events";
import { ResourceReservationSystem } from "./ResourceReservationSystem";
import {
  BUILDING_COSTS,
  BuildingLabel,
} from "../../types/simulation/buildings";

import { TaskSystem } from "./TaskSystem";

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
  taskId?: string;
}

const DEFAULT_CONFIG: BuildingSystemConfig = {
  decisionIntervalMs: 7_000,
  maxHouses: 8,
  maxMines: 4,
  maxWorkbenches: 3,
};

export interface BuildingMetadata {
  building?: string;
  buildingType?: string;
  underConstruction?: boolean;
  craftingStation?: boolean;
  constructionProgress?: number;
  ownerId?: string;
  [key: string]: string | number | boolean | undefined;
}

type MutableZone = Zone & {
  metadata?: BuildingMetadata;
  durability?: number;
  maxDurability?: number;
};

export class BuildingSystem {
  private readonly config: BuildingSystemConfig;
  private readonly now: () => number;
  private readonly constructionJobs = new Map<string, ConstructionJob>();
  private lastDecisionAt = 0;
  private taskSystem?: TaskSystem;

  constructor(
    private readonly state: GameState,
    private readonly reservationSystem: ResourceReservationSystem,
    config?: Partial<BuildingSystemConfig>,
    nowProvider: () => number = () => Date.now(),
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.now = nowProvider;
  }

  public setTaskSystem(taskSystem: TaskSystem): void {
    this.taskSystem = taskSystem;
  }

  public getConstructionJob(jobId: string): ConstructionJob | undefined {
    return this.constructionJobs.get(jobId);
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
      (z) =>
        z.metadata?.building === "mine" &&
        z.metadata?.underConstruction !== true,
    ).length;
    if (mines < this.config.maxMines && !this.hasActiveJob("mine")) {
      return "mine";
    }

    const workbenches = zones.filter(
      (z) => z.metadata?.craftingStation === true,
    ).length;
    if (
      workbenches < this.config.maxWorkbenches &&
      !this.hasActiveJob("workbench")
    ) {
      return "workbench";
    }

    return null;
  }

  private hasActiveJob(label: BuildingLabel): boolean {
    for (const job of this.constructionJobs.values()) {
      if (job.label === label) return true;
    }
    return false;
  }

  public enqueueConstruction(label: BuildingLabel): boolean {
    return this.tryScheduleConstruction(label, this.now());
  }

  public constructBuilding(
    label: BuildingLabel,
    position?: { x: number; y: number },
  ): boolean {
    return this.tryScheduleConstruction(label, this.now(), position);
  }

  private tryScheduleConstruction(
    label: BuildingLabel,
    now: number,
    position?: { x: number; y: number },
  ): boolean {
    const cost = BUILDING_COSTS[label];
    const reservationId = `build_${label}_${now}_${Math.random().toString(36).slice(2)}`;

    const reserved = this.reservationSystem.reserve(reservationId, {
      wood: cost.wood,
      stone: cost.stone,
    });
    if (!reserved) {
      return false;
    }

    const zone = this.createConstructionZone(label, position);
    const mutableZone = zone as MutableZone;
    (this.state.zones as MutableZone[]).push(mutableZone);

    let taskId: string | undefined;
    if (this.taskSystem) {
      const task = this.taskSystem.createTask({
        type: `build_${label}` as any,
        requiredWork: cost.time / 1000,
        zoneId: mutableZone.id,
        bounds: mutableZone.bounds,
        requirements: {
          minWorkers: 1,
        },
        metadata: {
          targetZoneId: mutableZone.id,
          buildingType: label,
        },
      });
      taskId = task?.id;
    }

    const job: ConstructionJob = {
      id: reservationId,
      zoneId: mutableZone.id,
      label,
      reservationId,
      completesAt: now + cost.time,
      taskId,
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

  private createConstructionZone(
    label: BuildingLabel,
    overridePosition?: { x: number; y: number },
  ): MutableZone {
    const worldSize = this.state.worldSize ?? { width: 2000, height: 2000 };
    const boundsPosition = overridePosition ?? {
      x: Math.floor(Math.random() * worldSize.width),
      y: Math.floor(Math.random() * worldSize.height),
    };

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
        x: Math.max(
          0,
          Math.min(boundsPosition.x, Math.max(0, worldSize.width - 120)),
        ),
        y: Math.max(
          0,
          Math.min(boundsPosition.y, Math.max(0, worldSize.height - 80)),
        ),
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
    for (const job of this.constructionJobs.values()) {
      if (now < job.completesAt) continue;
      this.finalizeConstruction(job, now);
    }
  }

  private finalizeConstruction(
    job: ConstructionJob,
    completedAt: number,
  ): void {
    this.constructionJobs.delete(job.id);

    if (job.taskId && this.taskSystem) {
      const task = this.taskSystem.getTask(job.taskId);
      if (task && !task.completed) {
        // Force complete the task if building is done
        task.completed = true;
        task.progress = task.requiredWork;
      }
    }

    const consumed = this.reservationSystem.consume(job.reservationId);
    if (!consumed) {
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
