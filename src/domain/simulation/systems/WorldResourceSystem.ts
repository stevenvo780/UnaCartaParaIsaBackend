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
    const sampleStep = 64;
    const biomesFound = new Set<string>();

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
              if (resource) spawned++;
            }
          }
        }
      }
    }
    logger.info(
      `[WorldResourceSystem] Biomes found: ${Array.from(biomesFound).join(", ")}`,
    );
    logger.info(`[WorldResourceSystem] Spawned ${spawned} resources in world`);
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

    return { success: true, amount: 1 };
  }

  public getZones(): Zone[] {
    return this.state.zones || [];
  }
}
