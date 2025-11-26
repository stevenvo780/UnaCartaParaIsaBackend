import { logger } from "@/infrastructure/utils/logger";
import type { GameState } from "../../types/game-types";
import type {
  Animal,
  AnimalSystemConfig,
} from "../../types/simulation/animals";
import type { TerrainTile } from "../../world/generation/types";
import type { WorldResourceInstance } from "../../types/simulation/worldResources";
import { getAnimalConfig } from "../../../infrastructure/services/world/config/AnimalConfigs";
import { AnimalNeeds } from "./animals/AnimalNeeds";
import { AnimalBehavior } from "./animals/AnimalBehavior";
import { AnimalSpawning } from "./animals/AnimalSpawning";
import { simulationEvents, GameEventNames } from "../core/events";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { TerrainSystem } from "./TerrainSystem";
import { AnimalBatchProcessor } from "./AnimalBatchProcessor";
import { getFrameTime } from "../../../shared/FrameTime";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";
import { SIM_CONSTANTS } from "../core/SimulationConstants";

const DEFAULT_CONFIG: AnimalSystemConfig = {
  maxAnimals: SIM_CONSTANTS.MAX_ANIMALS,
  spawnRadius: SIM_CONSTANTS.SPAWN_RADIUS,
  updateInterval: 50, // 20Hz to match FAST scheduler rate for smooth movement
  cleanupInterval: SIM_CONSTANTS.ANIMAL_CLEANUP_INTERVAL,
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { GPUComputeService } from "../core/GPUComputeService";

@injectable()
export class AnimalSystem {
  private gameState: GameState;
  private config: AnimalSystemConfig;
  private animals = new Map<string, Animal>();
  private worldResourceSystem?: WorldResourceSystem;
  private gpuService?: GPUComputeService;

  private lastCleanup = Date.now();

  private spatialGrid = new Map<string, Set<string>>();
  private readonly GRID_CELL_SIZE = SIM_CONSTANTS.SPATIAL_CELL_SIZE;

  private resourceSearchCache = new Map<
    string,
    {
      resources: Array<{
        id: string;
        position: { x: number; y: number };
        type: string;
      }>;
      timestamp: number;
    }
  >();
  private threatSearchCache = new Map<
    string,
    {
      threat: { id: string; position: { x: number; y: number } } | null;
      timestamp: number;
    }
  >();
  /**
   * Threat cache duration in milliseconds.
   * Increased to 30s for better performance with 1000+ animals.
   */
  private readonly CACHE_DURATION = 30000;

  private batchProcessor: AnimalBatchProcessor;
  /**
   * Threshold for activating batch processing.
   * 10 animals: GPU batch processing is efficient even with small counts.
   * AnimalSystem processes 4 needs per animal, so 10 animals = 40 operations.
   */
  private readonly BATCH_THRESHOLD = 100;

  /**
   * State logging optimization: log every 2s instead of 5% random chance.
   */
  private lastStateLog = 0;
  private readonly STATE_LOG_INTERVAL = 2000;

  /**
   * Staggered update optimization for idle/wandering animals.
   * Critical states (fleeing, hunting, etc.) update every frame.
   * Idle/wandering animals update less frequently to reduce CPU load.
   */
  private updateFrame = 0;
  private readonly IDLE_UPDATE_DIVISOR = 5; // Update idle animals every 5th frame

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.WorldResourceSystem)
    @optional()
    worldResourceSystem?: WorldResourceSystem,
    @inject(TYPES.TerrainSystem)
    @optional()
    private terrainSystem?: TerrainSystem,
    @inject(TYPES.GPUComputeService)
    @optional()
    gpuService?: GPUComputeService,
  ) {
    this.gameState = gameState;
    this.worldResourceSystem = worldResourceSystem;
    this.gpuService = gpuService;
    this.config = DEFAULT_CONFIG;
    this.batchProcessor = new AnimalBatchProcessor(gpuService);
    if (gpuService?.isGPUAvailable()) {
      logger.info(
        "🐾 AnimalSystem: GPU acceleration enabled for batch processing",
      );
    }

    this.setupEventListeners();
    logger.info("🐾 AnimalSystem (Backend) initialized");
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventNames.ANIMAL_HUNTED,
      (data: { animalId: string; hunterId: string }) => {
        this.handleAnimalHunted(data.animalId, data.hunterId);
      },
    );
  }

  public update(deltaMs: number): void {
    const startTime = performance.now();
    const now = getFrameTime();
    const deltaSeconds = deltaMs / 1000;
    const deltaMinutes = deltaMs / 60000;

    const shouldLogState = now - this.lastStateLog > this.STATE_LOG_INTERVAL;
    let liveCount = 0;
    let stateCount: Record<string, number> | null = null;

    if (shouldLogState) {
      stateCount = {};
      for (const animal of this.animals.values()) {
        if (!animal.isDead) {
          liveCount++;
          stateCount[animal.state] = (stateCount[animal.state] || 0) + 1;
        }
      }
      logger.info(
        `🐾 [AnimalSystem] States: ${JSON.stringify(stateCount)}, deltaMs=${deltaMs.toFixed(0)}`,
      );
      this.lastStateLog = now;
    } else {
      for (const animal of this.animals.values()) {
        if (!animal.isDead) liveCount++;
      }
    }

    if (liveCount >= this.BATCH_THRESHOLD) {
      this.updateBatch(deltaSeconds, deltaMinutes, now);
    } else {
      for (const animal of this.animals.values()) {
        if (animal.isDead) continue;

        const oldPosition = { ...animal.position };

        animal.age += this.config.updateInterval;
        AnimalNeeds.updateNeeds(animal, deltaMinutes);

        this.updateAnimalBehavior(animal, deltaSeconds);
        this.updateSpatialGrid(animal, oldPosition);
        this.checkAnimalDeath(animal);
      }
    }

    if (now - this.lastCleanup > this.config.cleanupInterval) {
      this.cleanupDeadAnimals();
      this.cleanCaches();
      this.lastCleanup = now;
    }

    this.updateGameStateSnapshot();
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "AnimalSystem",
      "update",
      duration,
    );
  }

  private updateBatch(
    deltaSeconds: number,
    deltaMinutes: number,
    _now: number,
  ): void {
    const startTime = performance.now();
    this.updateFrame++;
    this.batchProcessor.rebuildBuffers(this.animals);

    const animalIdArray = this.batchProcessor.getAnimalIdArray();
    const animalCount = animalIdArray.length;
    if (animalCount === 0) return;

    const hungerDecayRates = new Float32Array(animalCount);
    const thirstDecayRates = new Float32Array(animalCount);

    for (let i = 0; i < animalCount; i++) {
      const animalId = animalIdArray[i];
      const animal = this.animals.get(animalId);
      if (!animal || animal.isDead) continue;

      const config = getAnimalConfig(animal.type);
      if (config) {
        hungerDecayRates[i] = config.hungerDecayRate;
        thirstDecayRates[i] = config.thirstDecayRate;
      }
    }

    this.batchProcessor.updateNeedsBatch(
      hungerDecayRates,
      thirstDecayRates,
      deltaMinutes,
    );

    this.batchProcessor.updateAgesBatch(this.config.updateInterval);

    this.batchProcessor.syncToAnimals(this.animals);

    this.processFleeingAnimalsBatch(animalIdArray, deltaSeconds);

    /**
     * Staggered behavior updates: critical states (fleeing, hunting, etc.) update
     * every frame, while idle/wandering animals update less frequently.
     */
    for (let i = 0; i < animalCount; i++) {
      const animalId = animalIdArray[i];
      const animal = this.animals.get(animalId);
      if (!animal || animal.isDead) continue;

      if (animal.state === "fleeing") {
        const oldPosition = { ...animal.position };
        this.updateSpatialGrid(animal, oldPosition);
        this.checkAnimalDeath(animal);
        continue;
      }

      const isIdleState =
        animal.state === "idle" || animal.state === "wandering";
      if (
        isIdleState &&
        i % this.IDLE_UPDATE_DIVISOR !==
          this.updateFrame % this.IDLE_UPDATE_DIVISOR
      ) {
        continue;
      }

      const oldPosition = { ...animal.position };
      this.updateAnimalBehavior(
        animal,
        deltaSeconds * this.IDLE_UPDATE_DIVISOR,
      );
      this.updateSpatialGrid(animal, oldPosition);
      this.checkAnimalDeath(animal);
    }
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "AnimalSystem",
      "updateBatch",
      duration,
    );
  }

  /**
   * GPU batch processing for fleeing animals.
   * Computes flee vectors for all animals that are fleeing in parallel.
   * This is an O(A × T) operation where A = fleeing animals, T = threats.
   */
  private processFleeingAnimalsBatch(
    animalIds: string[],
    deltaSeconds: number,
  ): void {
    const fleeingAnimals: Array<{
      animal: Animal;
      threatPos: { x: number; y: number };
    }> = [];

    for (const animalId of animalIds) {
      const animal = this.animals.get(animalId);
      if (!animal || animal.isDead) continue;

      const config = getAnimalConfig(animal.type);
      if (!config) continue;

      const nearbyPredator = this.findNearbyPredator(
        animal,
        config.detectionRange,
      );
      if (nearbyPredator) {
        animal.state = "fleeing";
        animal.fleeTarget = nearbyPredator.id;
        animal.needs.fear = 100;
        animal.currentTarget = null;
        animal.targetPosition = null;
        fleeingAnimals.push({ animal, threatPos: nearbyPredator.position });
        continue;
      }

      if (config.fleeFromHumans) {
        const nearbyHuman = this.findNearbyHuman(animal, config.detectionRange);
        if (nearbyHuman) {
          animal.state = "fleeing";
          animal.fleeTarget = nearbyHuman.id;
          animal.needs.fear = 100;
          animal.currentTarget = null;
          animal.targetPosition = null;
          fleeingAnimals.push({ animal, threatPos: nearbyHuman.position });
        }
      }
    }

    if (this.gpuService?.isGPUAvailable() && fleeingAnimals.length >= 50) {
      this.computeFleeMovementsGPU(fleeingAnimals, deltaSeconds);
    } else {
      for (const { animal, threatPos } of fleeingAnimals) {
        AnimalBehavior.moveAwayFrom(animal, threatPos, 1.2, deltaSeconds);
      }
    }
  }

  /**
   * GPU-accelerated flee vector computation for multiple animals.
   */
  private computeFleeMovementsGPU(
    fleeingAnimals: Array<{
      animal: Animal;
      threatPos: { x: number; y: number };
    }>,
    deltaSeconds: number,
  ): void {
    const count = fleeingAnimals.length;
    const animalPositions = new Float32Array(count * 2);
    const threatPositions = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      animalPositions[i * 2] = fleeingAnimals[i].animal.position.x;
      animalPositions[i * 2 + 1] = fleeingAnimals[i].animal.position.y;
      threatPositions[i * 2] = fleeingAnimals[i].threatPos.x;
      threatPositions[i * 2 + 1] = fleeingAnimals[i].threatPos.y;
    }

    const newPositions = this.gpuService!.computeFleeVectorsBatch(
      animalPositions,
      threatPositions,
      1.2 * 50, // fleeSpeed * baseSpeed
      deltaSeconds,
    );

    for (let i = 0; i < count; i++) {
      fleeingAnimals[i].animal.position.x = newPositions[i * 2];
      fleeingAnimals[i].animal.position.y = newPositions[i * 2 + 1];
    }
  }

  private updateAnimalBehavior(animal: Animal, deltaSeconds: number): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    const nearbyPredator = this.findNearbyPredator(
      animal,
      config.detectionRange,
    );
    if (nearbyPredator) {
      animal.state = "fleeing";
      animal.fleeTarget = nearbyPredator.id;
      animal.needs.fear = 100;
      animal.currentTarget = null;
      animal.targetPosition = null;
      AnimalBehavior.moveAwayFrom(
        animal,
        nearbyPredator.position,
        1.2,
        deltaSeconds,
      );
      return;
    }

    if (config.fleeFromHumans) {
      const nearbyHuman = this.findNearbyHuman(animal, config.detectionRange);
      if (nearbyHuman) {
        animal.state = "fleeing";
        animal.fleeTarget = nearbyHuman.id;
        animal.needs.fear = 100;
        animal.currentTarget = null;
        animal.targetPosition = null;
        AnimalBehavior.moveAwayFrom(
          animal,
          nearbyHuman.position,
          1.0,
          deltaSeconds,
        );
        return;
      }
    }

    if (animal.needs.hunger < 30) {
      if (config.isPredator) {
        animal.state = "hunting";
        const prey = this.getAnimalsInRadius(
          animal.position,
          config.huntingRange || 200,
        );
        AnimalBehavior.huntPrey(animal, prey, deltaSeconds, (preyId) => {
          this.killAnimal(preyId, "hunted");
        });
        return;
      } else if (config.consumesVegetation) {
        animal.state = "seeking_food";
        const foodResources = this.findNearbyFood(
          animal,
          config.detectionRange,
        );
        if (foodResources.length > 0) {
          AnimalBehavior.seekFood(
            animal,
            foodResources,
            deltaSeconds,
            (resourceId) => {
              this.consumeResource(resourceId, animal.id);
            },
          );
          return;
        } else if (this.terrainSystem) {
          const TILE_SIZE = 64;
          const tileX = Math.floor(animal.position.x / TILE_SIZE);
          const tileY = Math.floor(animal.position.y / TILE_SIZE);

          const terrainTile = this.terrainSystem.getTile(tileX, tileY);

          if (
            terrainTile &&
            terrainTile.assets.terrain === "terrain_grassland"
          ) {
            animal.state = "eating";
            if (!animal.stateEndTime) {
              animal.stateEndTime = Date.now() + 2000;
            } else if (Date.now() > animal.stateEndTime) {
              this.terrainSystem.modifyTile(tileX, tileY, {
                assets: { terrain: "terrain_dirt" },
              });
              animal.needs.hunger = Math.min(100, animal.needs.hunger + 30);
              animal.state = "idle";
              animal.stateEndTime = undefined;
            }
            return;
          }
        }
        return;
      }
    }

    if (animal.needs.thirst < 30 && config.consumesWater) {
      animal.state = "seeking_water";
      const waterResources = this.findNearbyWater(
        animal,
        config.detectionRange,
      );

      if (waterResources.length > 0) {
        AnimalBehavior.seekWater(
          animal,
          waterResources,
          deltaSeconds,
          (resourceId) => {
            this.consumeResource(resourceId, animal.id);
          },
        );
      } else if (this.terrainSystem) {
        const waterTile = this.findNearbyWaterTile(
          animal,
          config.detectionRange,
        );
        if (waterTile) {
          this.drinkFromTerrain(animal, waterTile, config, deltaSeconds);
        } else {
          AnimalBehavior.wander(animal, 0.5, deltaSeconds);
        }
      } else {
        AnimalBehavior.wander(animal, 0.5, deltaSeconds);
      }
      return;
    }

    if (animal.needs.reproductiveUrge > 80) {
      animal.state = "mating";
      const mates = this.getAnimalsInRadius(animal.position, 60);
      AnimalBehavior.attemptReproduction(
        animal,
        mates,
        deltaSeconds,
        (offspring) => {
          this.addAnimal(offspring);
        },
      );
      return;
    }

    if (animal.state === "eating" || animal.state === "drinking") {
      if (animal.stateEndTime && Date.now() > animal.stateEndTime) {
        animal.state = "idle";
        animal.stateEndTime = undefined;
      }
      return;
    }

    if (animal.state === "idle") {
      if (Math.random() < 0.8) {
        animal.state = "wandering";
        AnimalBehavior.wander(animal, 0.5, deltaSeconds);
      }
    } else {
      animal.state = "wandering";
      AnimalBehavior.wander(animal, 0.5, deltaSeconds);
    }
  }

  private findNearbyPredator(
    animal: Animal,
    range: number,
  ): { id: string; position: { x: number; y: number } } | null {
    const cacheKey = `predator_${animal.id}`;
    const cached = this.threatSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      if (cached.threat) {
        const cachedAnimal = this.animals.get(cached.threat.id);
        if (!cachedAnimal || cachedAnimal.isDead) {
          // Cached threat is dead, invalidate cache and search fresh
          this.threatSearchCache.delete(cacheKey);
        } else {
          return cached.threat;
        }
      } else {
        return cached.threat;
      }
    }

    const nearbyAnimals = this.getAnimalsInRadius(animal.position, range);

    for (const predator of nearbyAnimals) {
      if (predator.id === animal.id) continue;

      const predatorConfig = getAnimalConfig(predator.type);
      if (!predatorConfig?.isPredator || !predatorConfig.preyTypes) continue;

      if (predatorConfig.preyTypes.includes(animal.type)) {
        const result = { id: predator.id, position: { ...predator.position } };
        this.threatSearchCache.set(cacheKey, {
          threat: result,
          timestamp: Date.now(),
        });
        return result;
      }
    }

    this.threatSearchCache.set(cacheKey, {
      threat: null,
      timestamp: Date.now(),
    });
    return null;
  }

  private findNearbyHuman(
    animal: Animal,
    range: number,
  ): { id: string; position: { x: number; y: number } } | null {
    const cached = this.threatSearchCache.get(`human_${animal.id}`);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.threat;
    }

    const entities = this.gameState.entities || [];
    for (const entity of entities) {
      if (entity.isDead) continue;
      const entityPos =
        entity.position ||
        (entity.x !== undefined && entity.y !== undefined
          ? { x: entity.x, y: entity.y }
          : null);
      if (!entityPos) continue;

      const dx = animal.position.x - entityPos.x;
      const dy = animal.position.y - entityPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= range * range) {
        const result = { id: entity.id, position: entityPos };
        this.threatSearchCache.set(`human_${animal.id}`, {
          threat: result,
          timestamp: Date.now(),
        });
        return result;
      }
    }

    this.threatSearchCache.set(`human_${animal.id}`, {
      threat: null,
      timestamp: Date.now(),
    });
    return null;
  }

  /**
   * Find nearby food resources
   */
  private findNearbyFood(
    animal: Animal,
    range: number,
  ): Array<{ id: string; position: { x: number; y: number }; type: string }> {
    const cacheKey = `food_${animal.id}`;
    const cached = this.resourceSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.resources;
    }

    if (!this.worldResourceSystem) return [];

    const resources =
      this.worldResourceSystem
        .getResourcesNear?.(animal.position, range)
        ?.filter(
          (r) =>
            r.type === "berry_bush" ||
            r.type === "tree" ||
            r.type === "mushroom_patch",
        )
        ?.map((r) => ({ id: r.id, position: r.position, type: r.type })) || [];

    this.resourceSearchCache.set(cacheKey, {
      resources,
      timestamp: Date.now(),
    });
    return resources;
  }

  /**
   * Find nearby water resources
   */
  private findNearbyWater(
    animal: Animal,
    range: number,
  ): Array<{ id: string; position: { x: number; y: number } }> {
    if (!this.worldResourceSystem) return [];

    const resources =
      this.worldResourceSystem
        .getResourcesNear?.(animal.position, range)
        ?.filter((r): r is WorldResourceInstance => r.type === "water_source")
        ?.map((r) => ({ id: r.id, position: r.position })) || [];

    return resources;
  }

  /**
   * Find nearby water terrain tiles (ocean, river, lake)
   */
  private findNearbyWaterTile(
    animal: Animal,
    range: number,
  ): { x: number; y: number; tileX: number; tileY: number } | null {
    if (!this.terrainSystem) return null;

    const TILE_SIZE = 64;
    const searchRadius = Math.ceil(range / TILE_SIZE);
    const centerTileX = Math.floor(animal.position.x / TILE_SIZE);
    const centerTileY = Math.floor(animal.position.y / TILE_SIZE);

    // Spiral search for nearest water tile
    for (let r = 1; r <= searchRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check perimeter

          const tileX = centerTileX + dx;
          const tileY = centerTileY + dy;
          const tile = this.terrainSystem.getTile(tileX, tileY);

          if (tile && this.isWaterTerrain(tile.assets?.terrain)) {
            return {
              x: (tileX + 0.5) * TILE_SIZE,
              y: (tileY + 0.5) * TILE_SIZE,
              tileX,
              tileY,
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if terrain type is water
   */
  private isWaterTerrain(terrainAsset: string | undefined): boolean {
    if (!terrainAsset) return false;
    return (
      terrainAsset.includes("water") ||
      terrainAsset.includes("ocean") ||
      terrainAsset.includes("river") ||
      terrainAsset.includes("lake")
    );
  }

  /**
   * Make animal drink from water terrain
   */
  private drinkFromTerrain(
    animal: Animal,
    waterTile: { x: number; y: number; tileX: number; tileY: number },
    config: ReturnType<typeof getAnimalConfig>,
    deltaSeconds: number,
  ): void {
    if (!config) return;

    const dx = waterTile.x - animal.position.x;
    const dy = waterTile.y - animal.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 40) {
      animal.state = "drinking";
      if (!animal.stateEndTime) {
        animal.stateEndTime = Date.now() + 2000;
      } else if (Date.now() > animal.stateEndTime) {
        AnimalNeeds.hydrate(animal, config.waterConsumptionRate * 20);
        animal.state = "idle";
        animal.stateEndTime = undefined;
        animal.targetPosition = null;
      }
    } else {
      animal.targetPosition = { x: waterTile.x, y: waterTile.y };
      AnimalBehavior.moveToward(
        animal,
        waterTile,
        config.speed * 0.6, // Note: genes.speed is applied inside moveToward
        deltaSeconds,
      );
    }
  }

  /**
   * Get animals within radius using spatial grid
   */
  public getAnimalsInRadius(
    position: { x: number; y: number },
    radius: number,
  ): Animal[] {
    const result: Animal[] = [];
    const radiusSq = radius * radius;

    const minX = Math.floor((position.x - radius) / this.GRID_CELL_SIZE);
    const maxX = Math.floor((position.x + radius) / this.GRID_CELL_SIZE);
    const minY = Math.floor((position.y - radius) / this.GRID_CELL_SIZE);
    const maxY = Math.floor((position.y + radius) / this.GRID_CELL_SIZE);

    for (let gridX = minX; gridX <= maxX; gridX++) {
      for (let gridY = minY; gridY <= maxY; gridY++) {
        const cellKey = `${gridX},${gridY}`;
        const cell = this.spatialGrid.get(cellKey);
        if (!cell) continue;

        for (const animalId of cell) {
          const animal = this.animals.get(animalId);
          if (!animal || animal.isDead) continue;

          const dx = animal.position.x - position.x;
          const dy = animal.position.y - position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= radiusSq) {
            result.push(animal);
          }
        }
      }
    }

    return result;
  }

  /**
   * Add animal to system
   */
  private addAnimal(animal: Animal): void {
    this.animals.set(animal.id, animal);
    this.addToSpatialGrid(animal);
  }

  /**
   * Get animal statistics for game state
   */
  public getStats(): {
    totalAnimals: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    let totalAnimals = 0;

    for (const animal of this.animals.values()) {
      if (!animal.isDead) {
        totalAnimals++;
        byType[animal.type] = (byType[animal.type] || 0) + 1;
      }
    }

    return {
      totalAnimals,
      byType,
    };
  }

  /**
   * Add animal to spatial grid
   */
  private addToSpatialGrid(animal: Animal): void {
    const cellKey = this.getGridCell(animal.position);
    let cell = this.spatialGrid.get(cellKey);
    if (!cell) {
      cell = new Set();
      this.spatialGrid.set(cellKey, cell);
    }
    cell.add(animal.id);
  }

  private updateGameStateSnapshot(): void {
    if (!this.gameState.animals) {
      this.gameState.animals = {
        animals: [],
        stats: {
          total: 0,
          byType: {},
        },
      };
    }

    const liveAnimals = [...this.animals.values()].filter((a) => !a.isDead);

    const byType: Record<string, number> = {};
    for (const animal of liveAnimals) {
      byType[animal.type] = (byType[animal.type] || 0) + 1;
    }

    const now = Date.now();
    if (!this._lastAnimalCountLog || now - this._lastAnimalCountLog > 5000) {
      logger.info(
        `🐾 [AnimalSystem] Map size: ${this.animals.size}, Live: ${liveAnimals.length}, Dead: ${this.animals.size - liveAnimals.length}`,
      );
      this._lastAnimalCountLog = now;
    }

    this.gameState.animals.animals = liveAnimals;
    this.gameState.animals.stats = {
      total: liveAnimals.length,
      byType,
    };
  }
  private _lastAnimalCountLog?: number;

  public spawnAnimal(
    type: string,
    position: { x: number; y: number },
    biome?: string,
  ): Animal | null {
    const resolvedBiome = biome || "grassland";
    const animal = AnimalSpawning.createAnimal(type, position, resolvedBiome);

    if (!animal) {
      return null;
    }

    this.addAnimal(animal);

    simulationEvents.emit(GameEventNames.ANIMAL_SPAWNED, {
      animalId: animal.id,
      type: animal.type,
      position: animal.position,
      biome: resolvedBiome,
    });

    this.updateGameStateSnapshot();
    return animal;
  }

  /**
   * Update animal position in spatial grid
   */
  private updateSpatialGrid(
    animal: Animal,
    oldPosition: { x: number; y: number },
  ): void {
    const oldCell = this.getGridCell(oldPosition);
    const newCell = this.getGridCell(animal.position);

    if (oldCell !== newCell) {
      this.spatialGrid.get(oldCell)?.delete(animal.id);
      this.addToSpatialGrid(animal);
    }
  }

  private getGridCell(position: { x: number; y: number }): string {
    const gridX = Math.floor(position.x / this.GRID_CELL_SIZE);
    const gridY = Math.floor(position.y / this.GRID_CELL_SIZE);
    return `${gridX},${gridY}`;
  }

  /**
   * Check if animal should die
   */
  private checkAnimalDeath(animal: Animal): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    if (AnimalNeeds.isStarving(animal)) {
      this.killAnimal(animal.id, "starvation");
      return;
    }

    if (AnimalNeeds.isDehydrated(animal)) {
      this.killAnimal(animal.id, "dehydration");
      return;
    }

    if (animal.age > config.lifespan) {
      this.killAnimal(animal.id, "old_age");
    }
  }

  /**
   * Kill an animal
   */
  private killAnimal(
    animalId: string,
    cause: "starvation" | "dehydration" | "old_age" | "hunted",
  ): void {
    const animal = this.animals.get(animalId);
    if (!animal || animal.isDead) return;

    animal.isDead = true;
    animal.state = "dead";

    simulationEvents.emit(GameEventNames.ANIMAL_DIED, {
      animalId,
      type: animal.type,
      position: animal.position,
      cause,
    });

    logger.warn(`💀 Animal died: ${animalId} (${cause})`);
  }

  /**
   * Handle animal hunted by agent
   */
  private handleAnimalHunted(animalId: string, _hunterId: string): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    const config = getAnimalConfig(animal.type);
    if (!config) return;

    /**
     * Kills the animal without re-emitting ANIMAL_HUNTED to avoid recursive event loops.
     * Downstream systems should react to ANIMAL_DIED with cause "hunted".
     * If additional payload is needed, consider emitting a distinct event
     * like ANIMAL_HUNT_RESOLVED consumed by non-AnimalSystem listeners.
     */
    this.killAnimal(animalId, "hunted");
  }

  /**
   * Consume a resource
   */
  private consumeResource(resourceId: string, consumerId: string): void {
    if (this.worldResourceSystem) {
      this.worldResourceSystem.harvestResource?.(resourceId, consumerId);
    }
  }

  /**
   * Clean up dead animals
   */
  private cleanupDeadAnimals(): void {
    const toRemove: string[] = [];

    for (const [id, animal] of this.animals) {
      if (animal.isDead) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const animal = this.animals.get(id);
      if (animal) {
        const cellKey = this.getGridCell(animal.position);
        this.spatialGrid.get(cellKey)?.delete(id);
      }
      this.animals.delete(id);
    }

    if (toRemove.length > 0) {
      logger.info(`🧹 Cleaned up ${toRemove.length} dead animals`);
    }
  }

  /**
   * Maximum cache size to prevent memory leaks.
   * Evicts oldest entries when exceeded.
   */
  private readonly MAX_CACHE_SIZE = 500;

  /**
   * Clean caches - removes expired entries AND limits cache size
   */
  private cleanCaches(): void {
    const now = Date.now();

    // Clean expired entries from resourceSearchCache
    for (const [key, cache] of this.resourceSearchCache.entries()) {
      if (now - cache.timestamp > this.CACHE_DURATION) {
        this.resourceSearchCache.delete(key);
      }
    }

    if (this.resourceSearchCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.resourceSearchCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      );
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      for (const [key] of toRemove) {
        this.resourceSearchCache.delete(key);
      }
    }

    for (const [key, cache] of this.threatSearchCache.entries()) {
      if (now - cache.timestamp > this.CACHE_DURATION) {
        this.threatSearchCache.delete(key);
      }
    }

    if (this.threatSearchCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.threatSearchCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      );
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      for (const [key] of toRemove) {
        this.threatSearchCache.delete(key);
      }
    }
  }

  /**
   * Get all animals
   */
  public getAnimals(): Map<string, Animal> {
    return this.animals;
  }

  /**
   * Get animal by ID
   */
  public getAnimal(id: string): Animal | undefined {
    return this.animals.get(id);
  }

  /**
   * Remove animal manually
   */
  public removeAnimal(id: string): void {
    const animal = this.animals.get(id);
    if (animal) {
      const cellKey = this.getGridCell(animal.position);
      this.spatialGrid.get(cellKey)?.delete(id);
      this.animals.delete(id);
    }
  }

  /**
   * Clear spawned chunks cache (for world reset)
   */
  public clearSpawnedChunks(): void {
    AnimalSpawning.clearSpawnedChunks();
  }

  /**
   * Spawn animals in world (for initialization)
   */
  public spawnAnimalsInWorld(
    width: number,
    height: number,
    tileSize: number,
    biomeMap: string[][],
  ): void {
    AnimalSpawning.spawnAnimalsInWorld(
      width,
      height,
      tileSize,
      biomeMap,
      (animal) => this.addAnimal(animal),
    );
  }

  /**
   * Spawn animals for a specific chunk
   */
  public spawnAnimalsForChunk(
    chunkCoords: { x: number; y: number },
    chunkBounds: { x: number; y: number; width: number; height: number },
    tiles?: TerrainTile[][],
  ): void {
    AnimalSpawning.spawnAnimalsInChunk(
      chunkCoords,
      chunkBounds,
      (animal) => {
        this.addAnimal(animal);
      },
      tiles,
    );
  }
}
