import type { GameState, Zone } from "../../types/game-types";
import { simulationEvents, GameEventType } from "../core/events";
import { ResourceReservationSystem } from "./ResourceReservationSystem";
import { WorldResourceSystem } from "./WorldResourceSystem";
import {
  BUILDING_COSTS,
  BuildingLabel,
} from "../../types/simulation/buildings";
import type { TaskType } from "../../types/simulation/tasks";
import { logger } from "../../../infrastructure/utils/logger";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { BuildingType } from "../../../shared/constants/BuildingEnums";
import { SystemStatus } from "../../../shared/constants/SystemEnums";
import { ZoneConstructionStatus } from "../../../shared/constants/StatusEnums";
import { TileType } from "../../../shared/constants/TileTypeEnums";

import { TaskSystem } from "./TaskSystem";
import { TerrainSystem } from "./TerrainSystem";

interface BuildingSystemConfig {
  decisionIntervalMs: number;
  maxHouses: number;
  maxMines: number;
  maxWorkbenches: number;
  maxFarms: number;
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
  maxFarms: 4,
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

/**
 * System for managing building construction and placement.
 *
 * Features:
 * - Construction job queue management
 * - Resource reservation for construction materials
 * - Task system integration for worker assignment
 * - Building limits per type (houses, mines, workbenches)
 * - Zone-based building placement
 *
 * @see ResourceReservationSystem for material reservation
 * @see TaskSystem for construction task management
 */
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
    @inject(TYPES.WorldResourceSystem)
    @optional()
    private readonly worldResourceSystem?: WorldResourceSystem,
    @inject(TYPES.TerrainSystem)
    @optional()
    private readonly terrainSystem?: TerrainSystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.now = (): number => Date.now();
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
    const houses = zones.filter((z) => z.type === ZoneType.REST).length;

    if (Math.random() < 0.15) {
      logger.debug(
        `🏗️ [BUILDING] Status: houses=${houses}/${this.config.maxHouses}, ` +
        `zones=${zones.length}, activeJobs=${this.constructionJobs.size}`,
      );
    }

    if (
      houses < this.config.maxHouses &&
      !this.hasActiveJob(BuildingType.HOUSE)
    ) {
      return BuildingType.HOUSE;
    }

    const mines = zones.filter(
      (z) =>
        z.metadata?.building === "mine" &&
        z.metadata?.underConstruction !== true,
    ).length;
    if (mines < this.config.maxMines && !this.hasActiveJob(BuildingType.MINE)) {
      return BuildingType.MINE;
    }

    const workbenches = zones.filter(
      (z) => z.metadata?.craftingStation === true,
    ).length;
    if (
      workbenches < this.config.maxWorkbenches &&
      !this.hasActiveJob(BuildingType.WORKBENCH)
    ) {
      return BuildingType.WORKBENCH;
    }

    const farms = zones.filter(
      (z) =>
        z.metadata?.building === "farm" &&
        z.metadata?.underConstruction !== true,
    ).length;
    if (farms < this.config.maxFarms && !this.hasActiveJob(BuildingType.FARM)) {
      return BuildingType.FARM;
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
      const available = this.reservationSystem.getAvailableResources();
      logger.debug(
        `🏗️ [BUILDING] Cannot reserve resources for ${label}: needs wood=${cost.wood}, stone=${cost.stone}. ` +
        `Available: wood=${available.wood}, stone=${available.stone}`,
      );
      return false;
    }

    const worldSize = this.state.worldSize ?? { width: 2000, height: 2000 };
    const boundsPosition = position ?? {
      x: Math.floor(Math.random() * worldSize.width),
      y: Math.floor(Math.random() * worldSize.height),
    };

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

    logger.debug(
      `🏗️ [BUILDING] Construction started: ${label} at (${validatedPosition.x}, ${validatedPosition.y}) - completes in ${cost.time}ms`,
    );

    simulationEvents.emit(GameEventType.BUILDING_CONSTRUCTION_STARTED, {
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
    const TILE_SIZE = 64;

    const zoneId = `zone_${label}_${Math.random().toString(36).slice(2)}`;

    // Determine biome
    const tileX = Math.floor(validatedPosition.x / TILE_SIZE);
    const tileY = Math.floor(validatedPosition.y / TILE_SIZE);
    const tile = this.state.terrainTiles?.find((t) => t.x === tileX && t.y === tileY);
    const biome = tile?.biome || "Grassland";

    const metadata: MutableZone["metadata"] = {
      building: label,
      underConstruction: true,
      craftingStation: label === "workbench",
      productionResource: label === "farm" ? "food" : undefined,
      biome: biome,
      buildingType:
        label === "house"
          ? BuildingType.HOUSE
          : label === "workbench"
            ? BuildingType.WORKBENCH
            : label === "mine"
              ? BuildingType.MINE
              : label === "farm"
                ? BuildingType.FARM
                : BuildingType.HOUSE,
      spriteVariant: Math.floor(Math.random() * 3), // Random variant 0-2
    };

    const bounds = {
      x: Math.max(0, Math.min(validatedPosition.x, worldSize.width - 120)),
      y: Math.max(0, Math.min(validatedPosition.y, worldSize.height - 80)),
      width: 120,
      height: 80,
    };

    if (this.worldResourceSystem) {
      this.worldResourceSystem.removeResourcesInArea(bounds);
    }

    if (this.terrainSystem) {
      const startTileX = Math.floor(bounds.x / TILE_SIZE);
      const startTileY = Math.floor(bounds.y / TILE_SIZE);
      const endTileX = Math.floor((bounds.x + bounds.width) / TILE_SIZE);
      const endTileY = Math.floor((bounds.y + bounds.height) / TILE_SIZE);

      for (let y = startTileY; y <= endTileY; y++) {
        for (let x = startTileX; x <= endTileX; x++) {
          this.terrainSystem.modifyTile(x, y, {
            assets: { terrain: TileType.TERRAIN_DIRT },
          });
        }
      }
    }

    return {
      id: zoneId,
      type: ZoneType.WORK,
      bounds,
      props: {
        color: "#C4B998",
        status: ZoneConstructionStatus.CONSTRUCTION,
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
    zone.metadata.building =
      job.label === BuildingType.MINE ? BuildingType.MINE : job.label;
    zone.metadata.craftingStation = job.label === BuildingType.WORKBENCH;
    zone.type =
      job.label === BuildingType.HOUSE
        ? ZoneType.REST
        : job.label === BuildingType.FARM
          ? ZoneType.FOOD
          : ZoneType.WORK;

    if (
      job.label === BuildingType.FARM &&
      this.worldResourceSystem &&
      zone.bounds
    ) {
      const bounds = zone.bounds as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      this.spawnFarmCrops(bounds);
    }
    zone.props = {
      ...(zone.props || {}),
      status: SystemStatus.READY,
    };
    zone.durability = 100;
    zone.maxDurability = 100;

    logger.debug(
      `🏠 [BUILDING] Construction completed: ${job.label} (zone: ${job.zoneId})`,
    );

    simulationEvents.emit(GameEventType.BUILDING_CONSTRUCTED, {
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
    buildingType: BuildingLabel,
  ): { x: number; y: number } | null {
    const BUILDING_WIDTH = Math.min(
      120,
      Math.max(8, Math.floor(worldSize.width * 0.1)),
    );
    const BUILDING_HEIGHT = Math.min(
      80,
      Math.max(6, Math.floor(worldSize.height * 0.1)),
    );
    const MAX_ATTEMPTS = 100;

    const zonesCount = this.state.zones?.length ?? 0;
    const terrainTilesCount = this.state.terrainTiles?.length ?? 0;
    const waterTilesCount =
      this.state.terrainTiles?.filter((t) => t.type === TileType.WATER)
        .length ?? 0;

    let boundsRejects = 0;
    let collisionRejects = 0;
    let waterRejects = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const testX =
        attempt === 0
          ? position.x
          : Math.floor(Math.random() * (worldSize.width - BUILDING_WIDTH));
      const testY =
        attempt === 0
          ? position.y
          : Math.floor(Math.random() * (worldSize.height - BUILDING_HEIGHT));

      if (
        testX < 0 ||
        testY < 0 ||
        testX + BUILDING_WIDTH > worldSize.width ||
        testY + BUILDING_HEIGHT > worldSize.height
      ) {
        boundsRejects++;
        continue;
      }

      const PADDING = 20; // Padding to prevent visual overlap
      const hasCollision = this.state.zones?.some((zone) => {
        if (!zone.bounds) return false;
        return !(
          testX + BUILDING_WIDTH + PADDING < zone.bounds.x ||
          testX > zone.bounds.x + zone.bounds.width + PADDING ||
          testY + BUILDING_HEIGHT + PADDING < zone.bounds.y ||
          testY > zone.bounds.y + zone.bounds.height + PADDING
        );
      });

      if (hasCollision) {
        collisionRejects++;
        continue;
      }

      if (this.state.terrainTiles) {
        const TILE_SIZE = 64;
        const centerX = testX + BUILDING_WIDTH / 2;
        const centerY = testY + BUILDING_HEIGHT / 2;
        const nearbyWater = this.state.terrainTiles.some((tile) => {
          const tilePixelX = (tile.x + 0.5) * TILE_SIZE;
          const tilePixelY = (tile.y + 0.5) * TILE_SIZE;
          const dx = tilePixelX - centerX;
          const dy = tilePixelY - centerY;
          const dist = Math.hypot(dx, dy);
          return dist < 60 && tile.type === TileType.WATER;
        });

        if (nearbyWater) {
          waterRejects++;
          continue;
        }
      }

      return { x: testX, y: testY };
    }

    logger.warn(
      `Could not find valid position for ${buildingType} after ${MAX_ATTEMPTS} attempts. ` +
      `Stats: worldSize=${worldSize.width}x${worldSize.height}, zones=${zonesCount}, ` +
      `terrainTiles=${terrainTilesCount}, waterTiles=${waterTilesCount}. ` +
      `Rejects: bounds=${boundsRejects}, collision=${collisionRejects}, water=${waterRejects}`,
    );
    return null;
  }

  /**
   * Spawns wheat crops in a farm zone after construction completes.
   * Creates a grid of wheat_crop resources within the farm bounds.
   */
  private spawnFarmCrops(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    if (!this.worldResourceSystem) return;

    const CROP_SPACING = 32;
    const MARGIN = 16;

    const startX = bounds.x + MARGIN;
    const startY = bounds.y + MARGIN;
    const endX = bounds.x + bounds.width - MARGIN;
    const endY = bounds.y + bounds.height - MARGIN;

    let cropsSpawned = 0;

    for (let y = startY; y < endY; y += CROP_SPACING) {
      for (let x = startX; x < endX; x += CROP_SPACING) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetY = (Math.random() - 0.5) * 8;

        const resource = this.worldResourceSystem.spawnResource(
          "wheat_crop",
          { x: x + offsetX, y: y + offsetY },
          "grassland",
        );

        if (resource) {
          cropsSpawned++;
        }
      }
    }

    logger.info(
      `🌾 [BUILDING] Farm completed: spawned ${cropsSpawned} wheat crops at (${bounds.x}, ${bounds.y})`,
    );
  }
}
