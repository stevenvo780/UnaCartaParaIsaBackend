import { logger } from "@/infrastructure/utils/logger";
import { SpatialGrid } from "../../../../shared/utils/SpatialGrid";
import { GameEventType, simulationEvents } from "../../core/events";
import { getResourceConfig } from "./config/WorldResourceConfigs";
import type {
  WorldResourceInstance,
  WorldResourceConfig,
} from "@/shared/types/simulation/worldResources";
import type { GameState, Zone } from "@/shared/types/game-types";
import {
  WorldResourceType,
  ResourceState,
} from "../../../../shared/constants/ResourceEnums";
import { BiomeType } from "../../../../shared/constants/BiomeEnums";
import { TileType } from "../../../../shared/constants/TileTypeEnums";
import { TerrainSystem } from "./TerrainSystem";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../config/Types";
import type { StateDirtyTracker } from "../../core/StateDirtyTracker";
import { performanceMonitor } from "../../core/PerformanceMonitor";
import { optional } from "inversify";

@injectable()
export class WorldResourceSystem {
  private gameState: GameState;
  private spatialGrid: SpatialGrid<string>;
  private resources: Map<string, WorldResourceInstance> = new Map();
  private lastRegenerationCheck = 0;
  private readonly REGENERATION_CHECK_INTERVAL = 5000;
  private regenerationTimers: Map<string, number> = new Map();

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.StateDirtyTracker)
    @optional()
    private dirtyTracker?: StateDirtyTracker,
    @inject(TYPES.TerrainSystem)
    @optional()
    private terrainSystem?: TerrainSystem,
  ) {
    this.gameState = gameState;
    if (!this.gameState.worldResources) {
      this.gameState.worldResources = {};
    }

    this.spatialGrid = new SpatialGrid(3200, 3200, 100);

    if (this.gameState.worldResources) {
      for (const resource of Object.values(this.gameState.worldResources)) {
        this.resources.set(resource.id, resource);
        this.spatialGrid.insert(resource.id, resource.position);
      }
    }
  }

  public update(_dt: number): void {
    const startTime = performance.now();
    const now = Date.now();

    if (now - this.lastRegenerationCheck > this.REGENERATION_CHECK_INTERVAL) {
      this.checkRegeneration(now);
      this.lastRegenerationCheck = now;
    }

    this.dirtyTracker?.markDirty("worldResources");

    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "WorldResourceSystem",
      "update",
      duration,
    );
  }

  public getResources(): Map<string, WorldResourceInstance> {
    return this.resources;
  }

  public getResource(id: string): WorldResourceInstance | undefined {
    return this.resources.get(id);
  }

  public addResource(resource: WorldResourceInstance): void {
    this.resources.set(resource.id, resource);
    if (this.gameState.worldResources) {
      this.gameState.worldResources[resource.id] = resource;
    }
    this.spatialGrid.insert(resource.id, resource.position);
  }

  public removeResource(id: string): void {
    this.resources.delete(id);
    if (this.gameState.worldResources) {
      delete this.gameState.worldResources[id];
    }
    this.spatialGrid.remove(id);
  }

  private checkRegeneration(now: number): void {
    for (const [resourceId, startTime] of this.regenerationTimers) {
      const resource = this.resources.get(resourceId);
      if (!resource) {
        this.regenerationTimers.delete(resourceId);
        continue;
      }

      const config = getResourceConfig(resource.type);
      const regenerationTime = config?.regenerationTime || 60000;

      if (now - startTime > regenerationTime) {
        resource.state = ResourceState.PRISTINE;
        resource.harvestCount = 0;
        resource.regenerationStartTime = undefined;
        this.regenerationTimers.delete(resourceId);
        this.dirtyTracker?.markDirty("worldResources");

        if (
          resource.linkedTileX !== undefined &&
          resource.linkedTileY !== undefined &&
          this.terrainSystem
        ) {
          this.terrainSystem.modifyTile(
            resource.linkedTileX,
            resource.linkedTileY,
            {
              assets: { terrain: TileType.WATER },
            },
          );
          logger.debug(
            `[WorldResourceSystem] Tile de agua (${resource.linkedTileX}, ${resource.linkedTileY}) regenerado`,
          );
        }

        simulationEvents.emit(GameEventType.RESOURCE_STATE_CHANGE, {
          resourceId,
          newState: ResourceState.PRISTINE,
        });

        if (this.gameState.worldResources) {
          this.gameState.worldResources[resourceId] = resource;
        }
      }
    }
  }

  public getResourcesInRadius(
    x: number,
    y: number,
    radius: number,
  ): WorldResourceInstance[] {
    const result: WorldResourceInstance[] = [];
    const nearbyIds = this.spatialGrid.queryRadius({ x, y }, radius);

    for (const { entity: id } of nearbyIds) {
      const resource = this.resources.get(id);
      if (resource) {
        result.push(resource);
      }
    }
    return result;
  }

  public getNearestResource(
    x: number,
    y: number,
    type?: WorldResourceType,
  ): WorldResourceInstance | undefined {
    const searchRadii = [200, 500, 1000, 2000];

    if (type === WorldResourceType.WATER_SOURCE) {
      const totalResources = this.resources.size;
      const waterResources = Array.from(this.resources.values()).filter(
        (r) => r.type === WorldResourceType.WATER_SOURCE,
      );
      logger.debug(
        `[WorldRes] getNearestResource(water_source) at (${x.toFixed(0)}, ${y.toFixed(0)}): totalResources=${totalResources}, waterResources=${waterResources.length}`,
      );
      if (waterResources.length > 0 && waterResources.length <= 5) {
        waterResources.forEach((r) =>
          logger.debug(
            `  - water: ${r.id} at (${r.position.x.toFixed(0)}, ${r.position.y.toFixed(0)}), state=${r.state}`,
          ),
        );
      }
    }

    for (const radius of searchRadii) {
      const nearbyIds = this.spatialGrid.queryRadius({ x, y }, radius);

      let nearest: WorldResourceInstance | undefined;
      let minDistSq = Infinity;
      let found = false;

      for (const { entity: id, distance } of nearbyIds) {
        const resource = this.resources.get(id);
        if (!resource) continue;

        if (type && resource.type !== type) continue;
        if (resource.state === ResourceState.DEPLETED) continue;

        const distSq = distance * distance;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = resource;
          found = true;
        }
      }

      if (found) return nearest;
    }

    if (type === WorldResourceType.WATER_SOURCE) {
      logger.debug(
        `[WorldRes] getNearestResource(water_source): NO WATER FOUND within 2000 units`,
      );
    }

    return undefined;
  }

  public spawnResourcesInWorld(worldConfig: {
    width: number;
    height: number;
    tileSize: number;
    biomeMap: string[][];
  }): void {
    const { width, height, tileSize, biomeMap } = worldConfig;
    let spawned = 0;
    const sampleStep = 32;
    const biomesFound = new Set<string>();
    const resourceCounts: Record<string, number> = {};

    for (let x = 0; x < width; x += sampleStep) {
      for (let y = 0; y < height; y += sampleStep) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);

        if (
          tileY >= 0 &&
          tileY < biomeMap.length &&
          tileX >= 0 &&
          tileX < biomeMap[0].length
        ) {
          const biome = biomeMap[tileY][tileX];
          if (biome) biomesFound.add(biome);
          const resourceConfigs = this.getResourcesForBiome(biome);

          for (const config of resourceConfigs) {
            if (Math.random() < config.spawnProbability!) {
              const resource = this.spawnResource(config.type, { x, y }, biome);
              if (resource) {
                spawned++;
                resourceCounts[config.type] =
                  (resourceCounts[config.type] || 0) + 1;
              }
            }
          }
        }
      }
    }
    logger.info(
      `[WorldResourceSystem] Biomes found: ${Array.from(biomesFound).join(", ")}`,
    );
    logger.info(`[WorldResourceSystem] Spawned ${spawned} resources in world`);
    logger.info(
      `[WorldResourceSystem] Resource breakdown: ${JSON.stringify(resourceCounts)}`,
    );
  }

  public spawnResource(
    type: string,
    position: { x: number; y: number },
    biome: string,
  ): WorldResourceInstance | null {
    const config = getResourceConfig(type);
    if (!config) return null;

    const validTypes: WorldResourceType[] = [
      WorldResourceType.TREE,
      WorldResourceType.ROCK,
      WorldResourceType.TRASH_PILE,
      WorldResourceType.BERRY_BUSH,
      WorldResourceType.MUSHROOM_PATCH,
      WorldResourceType.WHEAT_CROP,
    ];
    if (!validTypes.includes(type as WorldResourceType)) {
      return null;
    }

    const id = `resource_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const resource: WorldResourceInstance = {
      id,
      type: type as WorldResourceType,
      position,
      state: ResourceState.PRISTINE,
      harvestCount: 0,
      lastHarvestTime: 0,
      biome: biome as BiomeType,
      spawnedAt: Date.now(),
    };

    this.addResource(resource);

    simulationEvents.emit(GameEventType.RESOURCE_SPAWNED, { resource });

    return resource;
  }

  private spawnedChunks = new Set<string>();

  /**
   * Clears the set of spawned chunks, allowing resources to be spawned again.
   * Call this when loading a saved game to reinitialize chunk resources.
   */
  public clearSpawnedChunks(): void {
    this.spawnedChunks.clear();
    logger.info(
      `[WorldResourceSystem] Cleared spawnedChunks set for fresh resource spawning`,
    );
  }

  /**
   * Spawns resources for a specific chunk based on generated tiles and assets.
   * This ensures that visual assets (like trees) are interactive resources.
   * Water tiles are linked to their terrain tile - consuming all water converts the tile to dirt.
   */
  public spawnResourcesForChunk(
    chunkCoords: { x: number; y: number },
    _chunkBounds: { x: number; y: number; width: number; height: number },
    tiles: {
      x: number;
      y: number;
      biome?: string;
      assets: {
        terrain: string;
        vegetation?: string[];
        props?: string[];
        decals?: string[];
      };
    }[][],
  ): number {
    const chunkKey = `${chunkCoords.x},${chunkCoords.y}`;
    if (this.spawnedChunks.has(chunkKey)) {
      return 0;
    }
    this.spawnedChunks.add(chunkKey);

    let spawnedCount = 0;
    const tileSize = 64;

    for (const row of tiles) {
      for (const tile of row) {
        const pixelX = tile.x * tileSize;
        const pixelY = tile.y * tileSize;

        if (tile.assets.vegetation) {
          for (const asset of tile.assets.vegetation) {
            const resourceType = this.mapAssetToResource(asset);
            if (resourceType) {
              const offsetX = (Math.random() - 0.5) * (tileSize * 0.6);
              const offsetY = (Math.random() - 0.5) * (tileSize * 0.6);

              const resource = this.spawnResource(
                resourceType,
                {
                  x: pixelX + tileSize / 2 + offsetX,
                  y: pixelY + tileSize / 2 + offsetY,
                },
                tile.assets.terrain.replace("terrain_", ""),
              );

              if (resource) spawnedCount++;
            }
          }
        }

        if (tile.assets.decals) {
          for (const decal of tile.assets.decals) {
            const resourceType = this.mapDecalToResource(decal);
            if (resourceType) {
              const offsetX = (Math.random() - 0.5) * (tileSize * 0.8);
              const offsetY = (Math.random() - 0.5) * (tileSize * 0.8);

              const resource = this.spawnResource(
                resourceType,
                {
                  x: pixelX + tileSize / 2 + offsetX,
                  y: pixelY + tileSize / 2 + offsetY,
                },
                tile.assets.terrain.replace("terrain_", ""),
              );

              if (resource) spawnedCount++;
            }
          }
        }
      }
    }

    if (spawnedCount > 0) {
      logger.info(
        `[WorldResourceSystem] Spawned ${spawnedCount} resources for chunk ${chunkKey}`,
      );
    }

    return spawnedCount;
  }

  private mapAssetToResource(asset: string): WorldResourceType | null {
    if (asset.startsWith("tree_")) return WorldResourceType.TREE;
    if (asset.startsWith("plant_")) return WorldResourceType.BERRY_BUSH;
    if (asset.startsWith("prop_rock")) return WorldResourceType.ROCK;
    return null;
  }

  private mapDecalToResource(_decal: string): WorldResourceType | null {
    if (_decal.startsWith("decal_rock_")) return WorldResourceType.ROCK;

    const rand = Math.random();

    if (rand < 0.85) return null;

    const resourceRand = Math.random();

    if (resourceRand < 0.4) return WorldResourceType.ROCK;

    if (resourceRand < 0.75) return WorldResourceType.BERRY_BUSH;

    if (resourceRand < 0.95) return WorldResourceType.MUSHROOM_PATCH;

    return WorldResourceType.TRASH_PILE;
  }

  private getResourcesForBiome(biome: string): WorldResourceConfig[] {
    const configs = [
      getResourceConfig(WorldResourceType.TREE),
      getResourceConfig(WorldResourceType.ROCK),
      getResourceConfig(WorldResourceType.BERRY_BUSH),
      getResourceConfig(WorldResourceType.WATER_SOURCE),
      getResourceConfig(WorldResourceType.MUSHROOM_PATCH),
      getResourceConfig(WorldResourceType.WHEAT_CROP),
      getResourceConfig(WorldResourceType.TRASH_PILE),
    ];
    return configs.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null &&
        c !== undefined &&
        c.suitableBiomes?.includes(biome as BiomeType) === true,
    );
  }

  public getResourcesByType(type: WorldResourceType): WorldResourceInstance[] {
    if (!this.gameState.worldResources) return [];
    const results = Object.values(this.gameState.worldResources).filter(
      (r) => r.type === type,
    );
    if (type === WorldResourceType.WATER_SOURCE && results.length > 0) {
      const states = results.map((r) => r.state).join(", ");
      logger.debug(
        `[WorldRes] getResourcesByType(water_source) -> ${results.length} results, states: [${states}]`,
      );
    }
    return results;
  }

  public getResourcesNear(
    position: { x: number; y: number },
    radius: number,
  ): WorldResourceInstance[] {
    if (!this.gameState.worldResources) return [];

    const radiusSq = radius * radius;
    return Object.values(this.gameState.worldResources).filter(
      (resource: WorldResourceInstance) => {
        const dx = resource.position.x - position.x;
        const dy = resource.position.y - position.y;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq && resource.state !== ResourceState.DEPLETED;
      },
    );
  }

  public harvestResource(
    resourceId: string,
    harvesterId: string,
  ): { success: boolean; items: { type: string; amount: number }[] } {
    const resource = this.gameState.worldResources?.[resourceId];
    if (!resource || resource.state === ResourceState.DEPLETED) {
      return { success: false, items: [] };
    }

    const config = getResourceConfig(resource.type);
    if (!config) {
      return { success: false, items: [] };
    }

    resource.harvestCount = (resource.harvestCount || 0) + 1;
    resource.lastHarvestTime = Date.now();

    const previousState = resource.state;

    const maxHarvests = config.harvestsUntilDepleted || 5;
    const MAX_DEPLETION_CYCLES = 5;

    if (resource.harvestCount >= maxHarvests) {
      resource.state = ResourceState.DEPLETED;

      if (
        resource.linkedTileX !== undefined &&
        resource.linkedTileY !== undefined
      ) {
        resource.depletionCycles = (resource.depletionCycles || 0) + 1;

        if (this.terrainSystem) {
          this.terrainSystem.modifyTile(
            resource.linkedTileX,
            resource.linkedTileY,
            {
              assets: { terrain: TileType.TERRAIN_DIRT },
            },
          );
        }

        if (resource.depletionCycles >= MAX_DEPLETION_CYCLES) {
          logger.info(
            `[WorldResourceSystem] Tile de agua (${resource.linkedTileX}, ${resource.linkedTileY}) convertido a tierra permanente tras ${resource.depletionCycles} ciclos de agotamiento`,
          );
          delete this.gameState.worldResources![resourceId];
          this.resources.delete(resourceId);
          simulationEvents.emit(GameEventType.RESOURCE_DEPLETED, {
            resourceId,
            resourceType: resource.type,
            position: resource.position,
          });
        } else {
          logger.debug(
            `[WorldResourceSystem] Tile de agua (${resource.linkedTileX}, ${resource.linkedTileY}) agotado temporalmente (ciclo ${resource.depletionCycles}/${MAX_DEPLETION_CYCLES})`,
          );
          resource.regenerationStartTime = Date.now();
          this.regenerationTimers.set(resourceId, Date.now());
        }
      } else if (config.canRegenerate) {
        resource.regenerationStartTime = Date.now();
        this.regenerationTimers.set(resourceId, Date.now());
      } else {
        delete this.gameState.worldResources![resourceId];
        simulationEvents.emit(GameEventType.RESOURCE_DEPLETED, {
          resourceId,
          resourceType: resource.type,
          position: resource.position,
        });
      }

      simulationEvents.emit(GameEventType.RESOURCE_STATE_CHANGE, {
        resourceId,
        newState: ResourceState.DEPLETED,
        harvesterId,
      });
    } else if (resource.harvestCount >= maxHarvests * 0.7) {
      resource.state = ResourceState.HARVESTED_PARTIAL;
      simulationEvents.emit(GameEventType.RESOURCE_STATE_CHANGE, {
        resourceId,
        newState: ResourceState.HARVESTED_PARTIAL,
        harvesterId,
      });
    }

    simulationEvents.emit(GameEventType.RESOURCE_GATHERED, {
      resourceId,
      resourceType: resource.type,
      harvesterId,
      position: resource.position,
    });

    const yieldState =
      resource.state === ResourceState.DEPLETED &&
      previousState === ResourceState.HARVESTED_PARTIAL
        ? ResourceState.HARVESTED_PARTIAL
        : ResourceState.PRISTINE;

    const yields = config.yields?.[yieldState];
    let harvestAmount = 1;

    const items: { type: string; amount: number }[] = [];

    if (
      yields &&
      yields.amountMin !== undefined &&
      yields.amountMax !== undefined
    ) {
      harvestAmount = Math.floor(
        Math.random() * (yields.amountMax - yields.amountMin + 1) +
          yields.amountMin,
      );

      if (yields?.secondaryYields) {
        for (const secondary of yields.secondaryYields) {
          if (
            secondary.rareMaterialsChance &&
            Math.random() > secondary.rareMaterialsChance
          ) {
            continue;
          }

          const amount = Math.floor(
            Math.random() * (secondary.amountMax - secondary.amountMin + 1) +
              secondary.amountMin,
          );

          if (amount > 0) {
            items.push({ type: secondary.resourceType, amount });

            simulationEvents.emit(GameEventType.RESOURCE_GATHERED, {
              resourceId,
              resourceType: secondary.resourceType,
              harvesterId,
              position: resource.position,
            });
          }
        }
      }

      if (harvestAmount > 0) {
        items.push({ type: yields.resourceType, amount: harvestAmount });
      }

      return { success: true, items };
    }

    return { success: true, items };
  }

  public removeResourcesInArea(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    if (!this.gameState.worldResources) return;

    const toRemove: string[] = [];
    for (const resource of Object.values(this.gameState.worldResources)) {
      if (
        resource.position.x >= bounds.x &&
        resource.position.x <= bounds.x + bounds.width &&
        resource.position.y >= bounds.y &&
        resource.position.y <= bounds.y + bounds.height
      ) {
        toRemove.push(resource.id);
      }
    }

    for (const id of toRemove) {
      const resource = this.gameState.worldResources[id];
      delete this.gameState.worldResources[id];
      this.regenerationTimers.delete(id);

      simulationEvents.emit(GameEventType.RESOURCE_DEPLETED, {
        resourceId: id,
        resourceType: resource.type,
        position: resource.position,
      });
    }
  }

  public getZones(): Zone[] {
    return this.gameState.zones || [];
  }
}
