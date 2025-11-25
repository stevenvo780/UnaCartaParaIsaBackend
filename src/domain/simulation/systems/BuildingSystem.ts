import type { GameState, Zone } from "../../types/game-types";
import { simulationEvents, GameEventNames } from "../core/events";
import { ResourceReservationSystem } from "./ResourceReservationSystem";
import {
  BUILDING_COSTS,
  BuildingLabel,
} from "../../types/simulation/buildings";
import type { TaskType } from "../../types/simulation/tasks";
import { logger } from "../../../infrastructure/utils/logger";

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

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class BuildingSystem {
  private readonly config: BuildingSystemConfig;
  private readonly now: () => number;
  private readonly constructionJobs = new Map<string, ConstructionJob>();
  private lastDecisionAt = 0;
  private taskSystem?: TaskSystem;

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.ResourceReservationSystem)
    private readonly reservationSystem: ResourceReservationSystem,
    @inject(TYPES.TaskSystem) @optional() taskSystem?: TaskSystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.now = () => Date.now();
    this.taskSystem = taskSystem;
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

    const worldSize = this.state.worldSize ?? { width: 2000, height: 2000 };
    const boundsPosition = position ?? {
      x: Math.floor(Math.random() * worldSize.width),
      y: Math.floor(Math.random() * worldSize.height),
    };

    // Validar posición antes de crear la zona
    const validatedPosition = this.validateAndAdjustPosition(
      boundsPosition,
      worldSize,
      label,
    );

    if (!validatedPosition) {
      logger.warn(
        `Cannot schedule construction for ${label}: no valid position found`,
      );
      this.reservationSystem.release(reservationId);
      return false;
    }

    const zone = this.createConstructionZone(label, validatedPosition);
    const mutableZone = zone as MutableZone;
    (this.state.zones as MutableZone[]).push(mutableZone);

    let taskId: string | undefined;
    if (this.taskSystem) {
      const task = this.taskSystem.createTask({
        type: `build_${label}` as TaskType,
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

    // DEBUG: Log building construction start
    logger.debug(
      `🏗️ [BUILDING] Construction started: ${label} at (${validatedPosition.x}, ${validatedPosition.y}) - completes in ${cost.time}ms`,
    );

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
    validatedPosition: { x: number; y: number },
  ): MutableZone {
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
        x: Math.max(0, Math.min(validatedPosition.x, worldSize.width - 120)),
        y: Math.max(0, Math.min(validatedPosition.y, worldSize.height - 80)),
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

    // DEBUG: Log building completion
    logger.debug(
      `🏠 [BUILDING] Construction completed: ${job.label} (zone: ${job.zoneId})`,
    );

    simulationEvents.emit(GameEventNames.BUILDING_CONSTRUCTED, {
      jobId: job.id,
      zoneId: job.zoneId,
      label: job.label,
      completedAt,
    });
  }

  /**
   * Valida y ajusta la posición de construcción para evitar:
   * - Colisiones con otras zonas
   * - Posiciones en agua
   * - Posiciones fuera de límites
   * @returns Posición válida o null si no se encuentra después de MAX_ATTEMPTS
   */
  private validateAndAdjustPosition(
    position: { x: number; y: number },
    worldSize: { width: number; height: number },
    _buildingType: BuildingLabel,
  ): { x: number; y: number } | null {
    const BUILDING_WIDTH = 120;
    const BUILDING_HEIGHT = 80;
    const MAX_ATTEMPTS = 50;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const testX = attempt === 0
        ? position.x
        : Math.floor(Math.random() * (worldSize.width - BUILDING_WIDTH));
      const testY = attempt === 0
        ? position.y
        : Math.floor(Math.random() * (worldSize.height - BUILDING_HEIGHT));

      // Verificar límites del mundo
      if (
        testX < 0 ||
        testY < 0 ||
        testX + BUILDING_WIDTH > worldSize.width ||
        testY + BUILDING_HEIGHT > worldSize.height
      ) {
        continue;
      }

      // Verificar colisión con otras zonas
      const hasCollision = this.state.zones?.some((zone) => {
        if (!zone.bounds) return false;
        return !(
          testX + BUILDING_WIDTH < zone.bounds.x ||
          testX > zone.bounds.x + zone.bounds.width ||
          testY + BUILDING_HEIGHT < zone.bounds.y ||
          testY > zone.bounds.y + zone.bounds.height
        );
      });

      if (hasCollision) {
        continue;
      }

      // Verificar que no esté en agua (básico - verificar terreno si está disponible)
      if (this.state.terrainTiles) {
        const centerX = testX + BUILDING_WIDTH / 2;
        const centerY = testY + BUILDING_HEIGHT / 2;
        const nearbyWater = this.state.terrainTiles.some((tile) => {
          const dx = tile.x - centerX;
          const dy = tile.y - centerY;
          const dist = Math.hypot(dx, dy);
          return dist < 60 && tile.type === "water";
        });

        if (nearbyWater) {
          continue;
        }
      }

      return { x: testX, y: testY };
    }

    // Si no se encontró una posición válida después de MAX_ATTEMPTS, retornar null
    logger.warn(
      `Could not find valid position for building after ${MAX_ATTEMPTS} attempts`,
    );
    return null;
  }
}
