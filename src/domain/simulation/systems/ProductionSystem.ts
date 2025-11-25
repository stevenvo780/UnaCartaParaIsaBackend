import type { GameState, Zone } from "../../types/game-types";
import type { ResourceType } from "../../types/simulation/economy";
import { InventorySystem } from "./InventorySystem";
import { LifeCycleSystem } from "./LifeCycleSystem";
import { WorldResourceSystem } from "./WorldResourceSystem";
import { TerrainSystem } from "./TerrainSystem";
import { simulationEvents, GameEventNames } from "../core/events";

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
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

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
      GameEventNames.AGENT_DEATH,
      this.handleAgentDeath.bind(this),
    );
  }

  private handleAgentDeath(data: { entityId: string }): void {
    const { entityId } = data;
    for (const [zoneId, workers] of this.assignments.entries()) {
      if (workers.has(entityId)) {
        workers.delete(entityId);
        simulationEvents.emit(GameEventNames.PRODUCTION_WORKER_REMOVED, {
          zoneId,
          workerId: entityId,
          reason: "death",
        });
      }
    }
  }

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

  private isProductionZone(zone: MutableZone): boolean {
    if (zone.type === "food" || zone.type === "water") return true;
    const resource = this.getProductionResource(zone);
    return Boolean(resource);
  }

  private getProductionResource(zone: MutableZone): ResourceType | null {
    if (zone.type === "food" || zone.metadata?.productionResource === "food") {
      return "food";
    }
    if (
      zone.type === "water" ||
      zone.metadata?.productionResource === "water"
    ) {
      return "water";
    }
    return (zone.metadata?.productionResource as ResourceType) || null;
  }

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
      if (this.isAgentBusy(agent.id)) continue;
      assigned.add(agent.id);
    }
  }

  private isAgentBusy(agentId: string): boolean {
    for (const workers of this.assignments.values()) {
      if (workers.has(agentId)) return true;
    }
    return false;
  }

  private processProduction(zone: MutableZone, now: number): void {
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
    this.depositToZoneStockpile(zone.id, resource, amount);
    this.lastProduction.set(zone.id, now);

    simulationEvents.emit(GameEventNames.PRODUCTION_OUTPUT_GENERATED, {
      zoneId: zone.id,
      resource,
      amount,
      workers: Array.from(workers),
    });

    // Farming logic
    if (resource === "food" && this.terrainSystem) {
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
          tile.assets.terrain === "terrain_grassland" &&
          !hasObstacle
        ) {
          this.terrainSystem.modifyTile(tileX, tileY, {
            assets: { terrain: "terrain_dirt" },
          });
        }
      }
    }
  }

  private depositToZoneStockpile(
    zoneId: string,
    resource: ResourceType,
    amount: number,
  ): void {
    let stockpile = this.inventorySystem.getStockpilesInZone(zoneId)[0];
    if (!stockpile) {
      stockpile = this.inventorySystem.createStockpile(zoneId, "general", 150);
    }
    this.inventorySystem.addToStockpile(stockpile.id, resource, amount);
  }
}
