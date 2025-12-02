import type { GameState, Zone } from "@/shared/types/game-types";
import { simulationEvents, GameEventType } from "../../core/events";
import { ResourceReservationSystem } from "../economy/ResourceReservationSystem";
import { WorldResourceSystem } from "../world/WorldResourceSystem";
import {
  BUILDING_COSTS,
  BuildingLabel,
  BuildingState,
  calculateRepairCost,
  getBuildingCondition,
} from "@/shared/types/simulation/buildings";
import type { TaskType } from "@/shared/types/simulation/tasks";
import type { Inventory } from "@/shared/types/simulation/economy";
import type { InventorySystem } from "../economy/InventorySystem";
import { logger } from "../../../../infrastructure/utils/logger";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";
import { BuildingType } from "../../../../shared/constants/BuildingEnums";
import { SystemStatus } from "../../../../shared/constants/SystemEnums";
import { ZoneConstructionStatus } from "../../../../shared/constants/StatusEnums";
import { TileType } from "../../../../shared/constants/TileTypeEnums";
import { ResourceType } from "../../../../shared/constants/ResourceEnums";
import type { HandlerResult, IBuildingSystem } from "../agents/SystemRegistry";

import { TaskSystem } from "../objectives/TaskSystem";
import { TerrainSystem } from "../world/TerrainSystem";

interface BuildingSystemConfig {
  decisionIntervalMs: number;
  maxHouses: number;
  maxMines: number;
  maxWorkbenches: number;
  maxFarms: number;

  usageDegradationRate: number;
  usageDegradationInterval: number;
  abandonmentThreshold: number;
  normalDeteriorationRate: number;
  abandonedDeteriorationRate: number;
  repairEfficiency: number;
  maxDurabilityDecay: number;
  perfectRepairCostMultiplier: number;
  criticalDurabilityThreshold: number;
  ruinedDurabilityThreshold: number;
  destructionThreshold: number;
  maintenanceUpdateIntervalMs: number;
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

  usageDegradationRate: 0.4,
  usageDegradationInterval: 10,
  abandonmentThreshold: 5 * 60 * 1000,
  normalDeteriorationRate: 0.8,
  abandonedDeteriorationRate: 1.6,
  repairEfficiency: 35,
  maxDurabilityDecay: 1,
  perfectRepairCostMultiplier: 3,
  criticalDurabilityThreshold: 30,
  ruinedDurabilityThreshold: 10,
  destructionThreshold: 0,
  maintenanceUpdateIntervalMs: 5_000,
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
import { TYPES } from "../../../../config/Types";
import { QuestStatus } from "../../../../shared/constants/QuestEnums";
import { SystemProperty } from "../../../../shared/constants/SystemEnums";

/**
 * System for managing building construction, placement, and maintenance.
 *
 * Features:
 * - Construction job queue management
 * - Resource reservation for construction materials
 * - Task system integration for worker assignment
 * - Building limits per type (houses, mines, workbenches)
 * - Zone-based building placement
 * - Building maintenance and deterioration (merged from BuildingMaintenanceSystem)
 * - Building repair functionality
 * - Usage tracking and abandonment detection
 *
 * @see ResourceReservationSystem for material reservation
 * @see TaskSystem for construction task management
 */
@injectable()
export class BuildingSystem implements IBuildingSystem {
  public readonly name = "building";
  private readonly config: BuildingSystemConfig;
  private readonly now: () => number;
  private readonly constructionJobs = new Map<string, ConstructionJob>();
  private lastDecisionAt = 0;
  private taskSystem?: TaskSystem;

  private readonly buildingStates = new Map<string, BuildingState>();
  private lastMaintenanceUpdate = Date.now();
  private inventorySystem?: InventorySystem;

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
    @inject(TYPES.InventorySystem)
    @optional()
    inventorySystem?: InventorySystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.now = (): number => Date.now();
    this.taskSystem = taskSystem;
    this.inventorySystem = inventorySystem;

    this.bootstrapExistingZones();
    simulationEvents.on(
      GameEventType.BUILDING_CONSTRUCTED,
      (payload: { zoneId: string }): void =>
        this.initializeBuildingState(payload.zoneId),
    );

    simulationEvents.on(
      GameEventType.AGENT_DEATH,
      (_data: { agentId?: string; entityId?: string }) => {},
    );
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

    if (
      now - this.lastMaintenanceUpdate >=
      this.config.maintenanceUpdateIntervalMs
    ) {
      this.lastMaintenanceUpdate = now;
      for (const state of this.buildingStates.values()) {
        this.applyTimeDeterioration(state, now);
      }
    }

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
        z.metadata?.building === BuildingType.MINE &&
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
        z.metadata?.building === BuildingType.FARM &&
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

    const tileX = Math.floor(validatedPosition.x / TILE_SIZE);
    const tileY = Math.floor(validatedPosition.y / TILE_SIZE);
    const tile = this.state.terrainTiles?.find(
      (t) => t.x === tileX && t.y === tileY,
    );
    const biome = tile?.biome || "Grassland";

    const metadata: MutableZone[SystemProperty.METADATA] = {
      building: label,
      underConstruction: true,
      craftingStation: label === BuildingType.WORKBENCH,
      productionResource: label === BuildingType.FARM ? "food" : undefined,
      biome: biome,
      buildingType:
        label === BuildingType.HOUSE
          ? BuildingType.HOUSE
          : label === BuildingType.WORKBENCH
            ? BuildingType.WORKBENCH
            : label === BuildingType.MINE
              ? BuildingType.MINE
              : label === BuildingType.FARM
                ? BuildingType.FARM
                : BuildingType.HOUSE,
      spriteVariant: Math.floor(Math.random() * 3),
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

      const PADDING = 20;
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

  /**
   * Records building usage to track abandonment and apply usage degradation.
   */
  public recordUsage(zoneId: string): void {
    const state = this.buildingStates.get(zoneId);
    if (!state) return;

    state.lastUsageTime = this.now();
    state.usageCount += 1;
    state.isAbandoned = false;
    state.deteriorationRate = this.config.normalDeteriorationRate;

    if (state.usageCount % this.config.usageDegradationInterval === 0) {
      this.reduceDurability(state, this.config.usageDegradationRate, "usage");
    }
  }

  /**
   * Repairs a building, consuming resources from agent inventory.
   */
  public repairBuilding(
    zoneId: string,
    agentId: string,
    perfectRepair = false,
  ): boolean {
    const state = this.buildingStates.get(zoneId);
    if (!state) return false;

    const zone = this.findZoneById(zoneId);
    if (!zone) return false;

    if (!this.inventorySystem) return false;

    const inventory = this.inventorySystem.getAgentInventory(agentId) as
      | Inventory
      | undefined;
    if (!inventory) return false;

    const cost = calculateRepairCost(state.durability, perfectRepair);
    if (!this.hasMaintenanceResources(inventory, cost)) {
      return false;
    }

    this.consumeMaintenanceResources(agentId, cost);

    const previousDurability = state.durability;
    if (perfectRepair) {
      state.durability = state.maxDurability;
    } else {
      state.durability = Math.min(
        state.maxDurability,
        state.durability + this.config.repairEfficiency,
      );
      state.maxDurability = Math.max(
        50,
        state.maxDurability - this.config.maxDurabilityDecay,
      );
    }

    state.condition = getBuildingCondition(state.durability);
    state.lastMaintenanceTime = this.now();

    simulationEvents.emit(GameEventType.BUILDING_REPAIRED, {
      zoneId,
      agentId,
      previousDurability,
      newDurability: state.durability,
      perfectRepair,
    });

    this.syncZoneDurability(zoneId, state);
    return true;
  }

  /**
   * Starts an upgrade process for a building.
   */
  public startUpgrade(zoneId: string, _agentId: string): boolean {
    void _agentId;
    const state = this.buildingStates.get(zoneId);
    if (!state) return false;

    state.isUpgrading = true;
    state.upgradeStartTime = this.now();
    return true;
  }

  /**
   * Cancels an in-progress upgrade.
   */
  public cancelUpgrade(zoneId: string): boolean {
    const state = this.buildingStates.get(zoneId);
    if (!state || !state.isUpgrading) return false;

    state.isUpgrading = false;
    state.upgradeStartTime = undefined;
    return true;
  }

  /**
   * Gets the maintenance state for a building.
   */
  public getBuildingState(zoneId: string): BuildingState | undefined {
    return this.buildingStates.get(zoneId);
  }

  private bootstrapExistingZones(): void {
    for (const zone of (this.state.zones || []) as MutableZone[]) {
      if (zone.type === ZoneType.REST || zone.metadata?.building) {
        this.initializeBuildingState(zone.id);
      }
    }
  }

  private initializeBuildingState(zoneId: string): void {
    const zone = this.findZoneById(zoneId);
    if (!zone) return;

    const now = this.now();
    const state: BuildingState = {
      zoneId,
      durability: zone.durability ?? 100,
      maxDurability: zone.maxDurability ?? 100,
      condition: getBuildingCondition(zone.durability ?? 100),
      lastMaintenanceTime: now,
      lastUsageTime: now,
      usageCount: 0,
      isAbandoned: false,
      timeSinceLastUse: 0,
      deteriorationRate: this.config.normalDeteriorationRate,
    };

    this.buildingStates.set(zoneId, state);
    this.syncZoneDurability(zoneId, state);
  }

  private applyTimeDeterioration(state: BuildingState, now: number): void {
    const elapsed = now - state.lastUsageTime;
    state.timeSinceLastUse = elapsed;

    const wasAbandoned = state.isAbandoned;
    state.isAbandoned = elapsed > this.config.abandonmentThreshold;

    if (state.isAbandoned && !wasAbandoned) {
      state.deteriorationRate = this.config.abandonedDeteriorationRate;
    } else if (!state.isAbandoned && wasAbandoned) {
      state.deteriorationRate = this.config.normalDeteriorationRate;
    }

    const damage =
      (state.deteriorationRate / 3600_000) *
      this.config.maintenanceUpdateIntervalMs;
    this.reduceDurability(
      state,
      damage,
      state.isAbandoned ? "abandonment" : "time",
    );
  }

  private reduceDurability(
    state: BuildingState,
    amount: number,
    cause: "usage" | "abandonment" | "time",
  ): void {
    const previous = state.durability;
    state.durability = Math.max(0, state.durability - amount);
    state.condition = getBuildingCondition(state.durability);

    if (state.durability !== previous) {
      simulationEvents.emit(GameEventType.BUILDING_DAMAGED, {
        zoneId: state.zoneId,
        previousDurability: previous,
        newDurability: state.durability,
        cause,
      });
      this.syncZoneDurability(state.zoneId, state);
    }
  }

  private findZoneById(zoneId: string): MutableZone | undefined {
    return ((this.state.zones || []) as MutableZone[]).find(
      (z) => z.id === zoneId,
    );
  }

  private syncZoneDurability(zoneId: string, state: BuildingState): void {
    const zone = this.findZoneById(zoneId);
    if (!zone) return;
    zone.durability = state.durability;
    zone.maxDurability = state.maxDurability;
  }

  private hasMaintenanceResources(
    inventory: Inventory,
    cost: Partial<Record<"wood" | "stone", number>>,
  ): boolean {
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as "wood" | "stone";
      if ((inventory[key] ?? 0) < amount) {
        return false;
      }
    }
    return true;
  }

  private consumeMaintenanceResources(
    agentId: string,
    cost: Partial<Record<ResourceType, number>>,
  ): void {
    if (!this.inventorySystem) return;
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as ResourceType;
      this.inventorySystem.removeFromAgent(agentId, key, amount);
    }
  }



  /**
   * Solicita la construcción de un edificio.
   * @param agentId - ID del agente constructor
   * @param buildingType - Tipo de edificio a construir
   * @param position - Posición donde construir
   */
  public requestBuild(
    _agentId: string,
    buildingType: string,
    position: { x: number; y: number },
  ): HandlerResult {

    const label = buildingType as BuildingLabel;
    const cost = BUILDING_COSTS[label];

    if (!cost) {
      return {
        status: QuestStatus.FAILED,
        system: "building",
        message: `Unknown building type: ${buildingType}`,
      };
    }


    const started = this.constructBuilding(label, position);
    if (!started) {
      return {
        status: QuestStatus.FAILED,
        system: "building",
        message: `Failed to start construction of ${buildingType} - insufficient resources or invalid position`,
      };
    }

    return {
      status: "in_progress",
      system: "building",
      message: `Started construction of ${buildingType}`,
      data: { buildingType, position },
    };
  }

  /**
   * Solicita la reparación de un edificio.
   * @param agentId - ID del agente reparador
   * @param buildingId - ID de la zona/edificio a reparar
   */
  public requestRepair(agentId: string, buildingId: string): HandlerResult {
    const zone = this.findZoneById(buildingId);
    if (!zone) {
      return {
        status: QuestStatus.FAILED,
        system: "building",
        message: `Building not found: ${buildingId}`,
      };
    }

    const buildingState = this.buildingStates.get(buildingId);
    if (!buildingState) {
      return {
        status: QuestStatus.FAILED,
        system: "building",
        message: "Building has no state to repair",
      };
    }


    if (buildingState.durability >= buildingState.maxDurability) {
      return {
        status: "completed",
        system: "building",
        message: "Building is already at max durability",
      };
    }


    const repaired = this.repairBuilding(buildingId, agentId, false);
    if (!repaired) {
      return {
        status: QuestStatus.FAILED,
        system: "building",
        message: "Failed to repair - insufficient resources or inventory",
      };
    }

    return {
      status: "completed",
      system: "building",
      message: `Repaired building`,
      data: {
        newDurability: buildingState.durability,
        maxDurability: buildingState.maxDurability,
      },
    };
  }
}
