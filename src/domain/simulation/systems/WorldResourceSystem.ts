import { logger } from "@/infrastructure/utils/logger";
import { GameEventNames, simulationEvents } from "../core/events";
import { getResourceConfig } from "../../../infrastructure/services/world/config/WorldResourceConfigs";
import type {
  WorldResourceInstance,
  WorldResourceType,
  WorldResourceConfig,
} from "../../types/simulation/worldResources";
import type { GameState, Zone } from "../../types/game-types";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class WorldResourceSystem {
  private state: GameState;
  private regenerationTimers = new Map<string, number>();
  private readonly REGENERATION_CHECK_INTERVAL = 5000;
  private lastRegenerationCheck = 0;

  constructor(@inject(TYPES.GameState) state: GameState) {
    this.state = state;
    if (!this.state.worldResources) {
      this.state.worldResources = {};
    }

    simulationEvents.on(
      GameEventNames.RESOURCE_GATHERED,
      this.handleResourceGathered.bind(this),
    );
  }

  public update(_delta: number): void {
    void _delta;
    const now = Date.now();
    if (now - this.lastRegenerationCheck < this.REGENERATION_CHECK_INTERVAL) {
      return;
    }
    this.lastRegenerationCheck = now;
    this.processRegeneration(now);
  }

  private processRegeneration(now: number): void {
    if (!this.state.worldResources) return;

    for (const [resourceId, startTime] of Array.from(
      this.regenerationTimers.entries(),
    )) {
      const resource = this.state.worldResources[resourceId];
      if (!resource) {
        this.regenerationTimers.delete(resourceId);
        continue;
      }

      const config = getResourceConfig(resource.type);
      if (!config || !config.canRegenerate) {
        this.regenerationTimers.delete(resourceId);
        continue;
      }

      const elapsed = now - startTime;
      if (elapsed >= config.regenerationTime) {
        resource.state = "pristine";
        resource.harvestCount = 0;
        resource.regenerationStartTime = undefined;
        this.regenerationTimers.delete(resourceId);

        simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
          resourceId,
          newState: "pristine",
        });
      }
    }
  }

  public spawnResourcesInWorld(worldConfig: {
    width: number;
    height: number;
    tileSize: number;
    biomeMap: string[][];
  }): void {
    const { width, height, tileSize, biomeMap } = worldConfig;
    let spawned = 0;
    const sampleStep = 32; // Reduced from 64 to sample more frequently
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
      "tree",
      "rock",
      "trash_pile",
      "water_source",
      "berry_bush",
      "mushroom_patch",
      "wheat_crop",
    ];
    if (!validTypes.includes(type as WorldResourceType)) {
      return null;
    }

    const id = `resource_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const resource: WorldResourceInstance = {
      id,
      type: type as WorldResourceType,
      position,
      state: "pristine",
      harvestCount: 0,
      lastHarvestTime: 0,
      biome,
      spawnedAt: Date.now(),
    };

    this.state.worldResources![id] = resource;

    simulationEvents.emit(GameEventNames.RESOURCE_SPAWNED, { resource });

    return resource;
  }

  private spawnedChunks = new Set<string>();

  /**
   * Spawns resources for a specific chunk based on generated tiles and assets.
   * This ensures that visual assets (like trees) are interactive resources.
   */
  public spawnResourcesForChunk(
    chunkCoords: { x: number; y: number },
    _chunkBounds: { x: number; y: number; width: number; height: number },
    tiles: {
      x: number;
      y: number;
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
        // Check for vegetation assets
        if (tile.assets.vegetation) {
          for (const asset of tile.assets.vegetation) {
            const resourceType = this.mapAssetToResource(asset);
            if (resourceType) {
              const offsetX = (Math.random() - 0.5) * (tileSize * 0.6);
              const offsetY = (Math.random() - 0.5) * (tileSize * 0.6);
              const pixelX = tile.x * tileSize;
              const pixelY = tile.y * tileSize;

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

        // Check for decal assets (random loot)
        if (tile.assets.decals) {
          for (const decal of tile.assets.decals) {
            const resourceType = this.mapDecalToResource(decal);
            if (resourceType) {
              const offsetX = (Math.random() - 0.5) * (tileSize * 0.8);
              const offsetY = (Math.random() - 0.5) * (tileSize * 0.8);
              const pixelX = tile.x * tileSize;
              const pixelY = tile.y * tileSize;

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
    if (asset.startsWith("tree_")) return "tree";
    if (asset.startsWith("plant_")) return "berry_bush";
    if (asset.startsWith("prop_rock")) return "rock";
    return null;
  }

  private mapDecalToResource(_decal: string): WorldResourceType | null {
    // Specific mapping for rocks
    if (_decal.startsWith("decal_rock_")) return "rock";

    // Random loot generation from generic decals
    const rand = Math.random();

    // 40% chance for small rock/stone
    if (rand < 0.4) return "rock";

    // 30% chance for berry bush (food)
    if (rand < 0.7) return "berry_bush";

    // 20% chance for mushroom (food)
    if (rand < 0.9) return "mushroom_patch";

    // 10% chance for trash pile (crafting materials)
    return "trash_pile";
  }

  private getResourcesForBiome(biome: string): WorldResourceConfig[] {
    const configs = [
      getResourceConfig("tree"),
      getResourceConfig("rock"),
      getResourceConfig("berry_bush"),
      getResourceConfig("water_source"),
      getResourceConfig("mushroom_patch"),
      getResourceConfig("wheat_crop"),
      getResourceConfig("trash_pile"),
    ];
    return configs.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null &&
        c !== undefined &&
        c.suitableBiomes?.includes(biome) === true,
    );
  }

  private handleResourceGathered(data: {
    resourceId: string;
    amount: number;
  }): void {
    if (!this.state.worldResources) return;
    const resource = this.state.worldResources[data.resourceId];
    if (!resource) return;

    const config = getResourceConfig(resource.type);
    if (!config) return;

    resource.harvestCount += 1;
    resource.lastHarvestTime = Date.now();

    let newState = resource.state;
    if (resource.harvestCount >= config.harvestsUntilDepleted) {
      newState = "depleted";
    } else if (resource.harvestCount >= config.harvestsUntilPartial) {
      newState = "harvested_partial";
    }

    if (newState !== resource.state) {
      resource.state = newState;
      simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
        resourceId: resource.id,
        newState,
      });

      if (newState === "depleted" && config.canRegenerate) {
        resource.regenerationStartTime = Date.now();
        this.regenerationTimers.set(resource.id, Date.now());
      }
    }
  }

  public getResourcesByType(type: WorldResourceType): WorldResourceInstance[] {
    if (!this.state.worldResources) return [];
    return Object.values(this.state.worldResources).filter(
      (r) => r.type === type,
    );
  }

  public getResourcesNear(
    position: { x: number; y: number },
    radius: number,
  ): WorldResourceInstance[] {
    if (!this.state.worldResources) return [];

    const radiusSq = radius * radius;
    return Object.values(this.state.worldResources).filter(
      (resource: WorldResourceInstance) => {
        const dx = resource.position.x - position.x;
        const dy = resource.position.y - position.y;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq && resource.state !== "depleted";
      },
    );
  }

  public harvestResource(
    resourceId: string,
    harvesterId: string,
  ): { success: boolean; amount: number } {
    const resource = this.state.worldResources?.[resourceId];
    if (!resource || resource.state === "depleted") {
      return { success: false, amount: 0 };
    }

    const config = getResourceConfig(resource.type);
    if (!config) {
      return { success: false, amount: 0 };
    }

    resource.harvestCount = (resource.harvestCount || 0) + 1;
    resource.lastHarvestTime = Date.now();

    const maxHarvests = config.harvestsUntilDepleted || 5;
    if (resource.harvestCount >= maxHarvests) {
      resource.state = "depleted";

      if (config.canRegenerate) {
        resource.regenerationStartTime = Date.now();
        this.regenerationTimers.set(resourceId, Date.now());
      } else {
        delete this.state.worldResources![resourceId];
        simulationEvents.emit(GameEventNames.RESOURCE_DEPLETED, {
          resourceId,
          resourceType: resource.type,
          position: resource.position,
        });
      }

      simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
        resourceId,
        newState: "depleted",
        harvesterId,
      });
    } else if (resource.harvestCount >= maxHarvests * 0.7) {
      resource.state = "harvested_partial";
      simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
        resourceId,
        newState: "harvested_partial",
        harvesterId,
      });
    }

    simulationEvents.emit(GameEventNames.RESOURCE_GATHERED, {
      resourceId,
      resourceType: resource.type,
      harvesterId,
      position: resource.position,
    });

    // Calculate actual harvest amount from config yields
    const currentState =
      resource.state === "harvested_partial" ? "depleted" : "pristine";
    const yields = config.yields?.[currentState];
    let harvestAmount = 1; // Default fallback

    if (
      yields &&
      yields.amountMin !== undefined &&
      yields.amountMax !== undefined
    ) {
      harvestAmount = Math.floor(
        Math.random() * (yields.amountMax - yields.amountMin + 1) +
        yields.amountMin,
      );
    }

    return { success: true, amount: harvestAmount };
  }

  public removeResourcesInArea(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    if (!this.state.worldResources) return;

    const toRemove: string[] = [];
    for (const resource of Object.values(this.state.worldResources)) {
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
      const resource = this.state.worldResources[id];
      delete this.state.worldResources[id];
      this.regenerationTimers.delete(id);

      simulationEvents.emit(GameEventNames.RESOURCE_DEPLETED, {
        resourceId: id,
        resourceType: resource.type,
        position: resource.position,
      });
    }
  }

  public getZones(): Zone[] {
    return this.state.zones || [];
  }
}
