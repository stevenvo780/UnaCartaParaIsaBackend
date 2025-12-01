import type { GameState, Zone } from "../../../types/game-types";
import type { ResourceType } from "../../../types/simulation/economy";
import { InventorySystem } from "../economy/InventorySystem";
import { LifeCycleSystem } from "../lifecycle/LifeCycleSystem";
import { WorldResourceSystem } from "./WorldResourceSystem";
import { TerrainSystem } from "../core/TerrainSystem";
import { simulationEvents, GameEventType } from "../../core/events";
import { performance } from "perf_hooks";
import { performanceMonitor } from "../../core/PerformanceMonitor";
import { ResourceType as ResourceTypeEnum } from "../../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";
import { StockpileType } from "../../../../shared/constants/ZoneEnums";
import { TileType } from "../../../../shared/constants/TileTypeEnums";

interface ProductionConfig {
  updateIntervalMs: number;
  productionIntervalMs: number;
  maxWorkersPerZone: number;
  baseYieldPerWorker: number;
}

const DEFAULT_CONFIG: ProductionConfig = {
  updateIntervalMs: 5_000,
  productionIntervalMs: 12_000,
  maxWorkersPerZone: 2,
  baseYieldPerWorker: 4,
};

export interface ProductionMetadata {
  productionResource?: ResourceType;
  productionRate?: number;
  workers?: number;
  efficiency?: number;
  [key: string]: string | number | undefined;
}

type MutableZone = Zone & {
  metadata?: ProductionMetadata;
  durability?: number;
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";

/**
 * System for managing resource production in designated zones.
 *
 * Main flow:
 * 1. `update()`: Runs periodically according to `updateIntervalMs`.
 * 2. Iterates over all production zones (food, water, or specific resources).
 * 3. `ensureAssignments()`: Assigns available workers to zones if there are vacancies.
 * 4. `processProduction()`: Generates resources if production interval has elapsed.
 * 5. Generated resources are deposited to zone inventory (`depositToZoneStockpile`).
 * 6. Emits production events (`PRODUCTION_OUTPUT_GENERATED`).
 * 7. May modify terrain visually (e.g., agriculture).
 *
 * @see InventorySystem for resource storage
 * @see LifeCycleSystem for worker availability
 */
@injectable()
export class ProductionSystem {
  private readonly config: ProductionConfig;
  private readonly lastProduction = new Map<string, number>();
  private readonly assignments = new Map<string, Set<string>>();
  private lastUpdate = Date.now();

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
    @inject(TYPES.LifeCycleSystem)
    private readonly lifeCycleSystem: LifeCycleSystem,
    @inject(TYPES.WorldResourceSystem)
    @optional()
    private readonly worldResourceSystem?: WorldResourceSystem,
    @inject(TYPES.TerrainSystem)
    @optional()
    private readonly terrainSystem?: TerrainSystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventType.AGENT_DEATH,
      this.handleAgentDeath.bind(this),
    );
  }

  /**
   * Handles agent death, removing them from any work assignments.
   *
   * @param data - Death event data
   */
  private handleAgentDeath(data: { entityId: string }): void {
    const { entityId } = data;
    for (const [zoneId, workers] of this.assignments.entries()) {
      if (workers.has(entityId)) {
        workers.delete(entityId);
        simulationEvents.emit(GameEventType.PRODUCTION_WORKER_REMOVED, {
          zoneId,
          workerId: entityId,
          reason: "death",
        });
      }
    }
  }

  /**
   * Main update cycle.
   * Checks if it's time to process production and updates each zone.
   *
   * @param _deltaMs - Elapsed time since last update (not used, fixed interval is used instead)
   */
  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    for (const zone of (this.state.zones || []) as MutableZone[]) {
      if (!this.isProductionZone(zone)) continue;
      this.ensureAssignments(zone);
      this.processProduction(zone, now);
    }
  }

  /**
   * Determines if a zone is capable of producing resources.
   *
   * @param zone - Zone to evaluate
   * @returns True if zone can produce resources
   */
  private isProductionZone(zone: MutableZone): boolean {
    if (zone.type === ZoneType.FOOD || zone.type === ZoneType.WATER)
      return true;
    const resource = this.getProductionResource(zone);
    return Boolean(resource);
  }

  /**
   * Gets the resource type produced by a zone.
   *
   * @param zone - Zone to query
   * @returns Resource type or null if zone doesn't produce anything
   */
  private getProductionResource(zone: MutableZone): ResourceType | null {
    if (
      zone.type === ZoneType.FOOD ||
      zone.metadata?.productionResource === ResourceTypeEnum.FOOD
    ) {
      return ResourceTypeEnum.FOOD;
    }
    if (
      zone.type === ZoneType.WATER ||
      zone.metadata?.productionResource === ResourceTypeEnum.WATER
    ) {
      return ResourceTypeEnum.WATER;
    }
    return (zone.metadata?.productionResource as ResourceType) || null;
  }

  /**
   * Ensures zone has workers assigned up to maximum capacity.
   * Searches for idle agents through `LifeCycleSystem`.
   *
   * @param zone - Zone to manage
   */
  private ensureAssignments(zone: MutableZone): void {
    const assigned = this.assignments.get(zone.id) ?? new Set<string>();
    if (!this.assignments.has(zone.id)) {
      this.assignments.set(zone.id, assigned);
    }

    const required = this.config.maxWorkersPerZone;
    if (assigned.size >= required) {
      return;
    }

    const agents = this.lifeCycleSystem.getAgents();
    for (const agent of agents) {
      if (assigned.size >= required) break;
      if (agent.isDead) continue;
      if (this.isAgentBusy(agent.id)) continue;
      assigned.add(agent.id);
    }
  }

  /**
   * Checks if an agent is already working in any zone.
   *
   * @param agentId - Agent identifier
   * @returns True if agent is busy
   */
  private isAgentBusy(agentId: string): boolean {
    for (const workers of this.assignments.values()) {
      if (workers.has(agentId)) return true;
    }
    return false;
  }

  /**
   * Executes production logic for a specific zone.
   * Calculates produced amount based on workers and base yield.
   * May modify terrain visually (e.g., convert grass to farmland).
   *
   * @param zone - Production zone
   * @param now - Current timestamp
   */
  private processProduction(zone: MutableZone, now: number): void {
    const startTime = performance.now();
    const last = this.lastProduction.get(zone.id) ?? 0;
    if (now - last < this.config.productionIntervalMs) {
      return;
    }

    const workers = this.assignments.get(zone.id);
    if (!workers || workers.size === 0) {
      return;
    }

    const resource = this.getProductionResource(zone);
    if (!resource) return;

    const amount = workers.size * this.config.baseYieldPerWorker;

    if (zone.durability !== undefined && zone.durability <= 0) {
      return;
    }

    this.depositToZoneStockpile(zone.id, resource, amount);
    this.lastProduction.set(zone.id, now);

    simulationEvents.emit(GameEventType.PRODUCTION_OUTPUT_GENERATED, {
      zoneId: zone.id,
      resource,
      amount,
      workers: Array.from(workers),
    });

    if (resource === ResourceTypeEnum.FOOD && this.terrainSystem) {
      const tilesToModify = Math.min(workers.size, 3);
      const TILE_SIZE = 64;

      for (let i = 0; i < tilesToModify; i++) {
        const xOffset = Math.random() * zone.bounds.width;
        const yOffset = Math.random() * zone.bounds.height;

        const worldX = zone.bounds.x + xOffset;
        const worldY = zone.bounds.y + yOffset;

        const tileX = Math.floor(worldX / TILE_SIZE);
        const tileY = Math.floor(worldY / TILE_SIZE);

        const tile = this.terrainSystem.getTile(tileX, tileY);

        let hasObstacle = false;
        if (this.worldResourceSystem) {
          const resources = this.worldResourceSystem.getResourcesNear(
            { x: worldX, y: worldY },
            32,
          );
          if (resources.length > 0) {
            hasObstacle = true;
          }
        }

        if (
          tile &&
          tile.assets.terrain === TileType.TERRAIN_GRASSLAND &&
          !hasObstacle
        ) {
          this.terrainSystem.modifyTile(tileX, tileY, {
            assets: { terrain: TileType.TERRAIN_DIRT },
          });
        }
      }
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "ProductionSystem",
      "processProduction",
      duration,
    );
  }

  /**
   * Deposits produced resources to zone storage.
   * Creates new storage if none exists.
   *
   * @param zoneId - Zone identifier
   * @param resource - Resource type
   * @param amount - Amount to deposit
   */
  private depositToZoneStockpile(
    zoneId: string,
    resource: ResourceType,
    amount: number,
  ): void {
    let stockpile = this.inventorySystem.getStockpilesInZone(zoneId)[0];
    if (!stockpile) {
      stockpile = this.inventorySystem.createStockpile(
        zoneId,
        StockpileType.GENERAL,
        150,
      );
    }
    this.inventorySystem.addToStockpile(stockpile.id, resource, amount);
  }
}
