import { logger } from "@/infrastructure/utils/logger";
import type { GameState } from "../../types/game-types";
import type {
  Animal,
  AnimalSystemConfig,
} from "../../types/simulation/animals";
import type { WorldResourceInstance } from "../../types/simulation/worldResources";
import { getAnimalConfig } from "../../../infrastructure/services/world/config/AnimalConfigs";
import { AnimalNeeds } from "./animals/AnimalNeeds";
import { AnimalBehavior } from "./animals/AnimalBehavior";
import { AnimalSpawning } from "./animals/AnimalSpawning";
import { simulationEvents, GameEventNames } from "../core/events";
import type { WorldResourceSystem } from "./WorldResourceSystem";

const DEFAULT_CONFIG: AnimalSystemConfig = {
  maxAnimals: 500,
  spawnRadius: 300,
  updateInterval: 1000,
  cleanupInterval: 30000,
};

export class AnimalSystem {
  private gameState: GameState;
  private config: AnimalSystemConfig;
  private animals = new Map<string, Animal>();
  private worldResourceSystem?: WorldResourceSystem;

  private lastUpdate = 0;
  private lastCleanup = 0;

  private spatialGrid = new Map<string, Set<string>>();
  private readonly GRID_CELL_SIZE = 256;

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
  private readonly CACHE_DURATION = 5000;

  constructor(
    gameState: GameState,
    config?: Partial<AnimalSystemConfig>,
    worldResourceSystem?: WorldResourceSystem,
  ) {
    this.gameState = gameState;
    this.worldResourceSystem = worldResourceSystem;
    this.config = { ...DEFAULT_CONFIG, ...config };

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

    simulationEvents.on(
      GameEventNames.CHUNK_RENDERED,
      (data: {
        coords: { x: number; y: number };
        bounds: { x: number; y: number; width: number; height: number };
      }) => {
        AnimalSpawning.spawnAnimalsInChunk(
          data.coords,
          data.bounds,
          (animal) => {
            this.addAnimal(animal);
          },
        );
      },
    );
  }

  public update(_deltaMs: number): void {
    const now = Date.now();

    if (now - this.lastUpdate < this.config.updateInterval) {
      return;
    }

    const deltaSeconds = (now - this.lastUpdate) / 1000;
    const deltaMinutes = (now - this.lastUpdate) / 60000;
    this.lastUpdate = now;

    this.animals.forEach((animal) => {
      if (animal.isDead) return;

      const oldPosition = { ...animal.position };

      animal.age += this.config.updateInterval;
      AnimalNeeds.updateNeeds(animal, deltaMinutes);

      // Update behavior based on state
      this.updateAnimalBehavior(animal, deltaSeconds);

      // Update spatial grid if moved
      this.updateSpatialGrid(animal, oldPosition);

      // Check for death conditions
      this.checkAnimalDeath(animal);
    });

    // Periodic cleanup
    if (now - this.lastCleanup > this.config.cleanupInterval) {
      this.cleanupDeadAnimals();
      this.cleanCaches();
      this.lastCleanup = now;
    }

    // Escribir estado en GameState para sincronización con frontend
    if (!this.gameState.animals) {
      this.gameState.animals = {
        animals: [],
        stats: {
          total: 0,
          byType: {},
        },
      };
    }

    // Convertir Map a Array para serialización
    this.gameState.animals.animals = Array.from(this.animals.values()).filter(
      (a) => !a.isDead,
    );

    // Calcular estadísticas
    const byType: Record<string, number> = {};
    let total = 0;
    this.gameState.animals.animals.forEach((animal) => {
      byType[animal.type] = (byType[animal.type] || 0) + 1;
      total++;
    });

    this.gameState.animals.stats = {
      total,
      byType,
    };
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
        AnimalBehavior.seekFood(
          animal,
          foodResources,
          deltaSeconds,
          (resourceId) => {
            this.consumeResource(resourceId, animal.id);
          },
        );
        return;
      }
    }

    if (animal.needs.thirst < 30 && config.consumesWater) {
      animal.state = "seeking_water";
      const waterResources = this.findNearbyWater(
        animal,
        config.detectionRange,
      );
      AnimalBehavior.seekWater(
        animal,
        waterResources,
        deltaSeconds,
        (resourceId) => {
          this.consumeResource(resourceId, animal.id);
        },
      );
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
      if (Math.random() < 0.2) {
        animal.state = "wandering";
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
      return cached.threat;
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

    // Get harvestable resources near animal
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
   * Get animals within radius using spatial grid
   */
  private getAnimalsInRadius(
    position: { x: number; y: number },
    radius: number,
  ): Animal[] {
    const result: Animal[] = [];
    const radiusSq = radius * radius;

    // Get grid cells to check
    const minX = Math.floor((position.x - radius) / this.GRID_CELL_SIZE);
    const maxX = Math.floor((position.x + radius) / this.GRID_CELL_SIZE);
    const minY = Math.floor((position.y - radius) / this.GRID_CELL_SIZE);
    const maxY = Math.floor((position.y + radius) / this.GRID_CELL_SIZE);

    for (let gridX = minX; gridX <= maxX; gridX++) {
      for (let gridY = minY; gridY <= maxY; gridY++) {
        const cellKey = `${gridX},${gridY}`;
        const cell = this.spatialGrid.get(cellKey);
        if (!cell) continue;

        cell.forEach((animalId) => {
          const animal = this.animals.get(animalId);
          if (!animal || animal.isDead) return;

          const dx = animal.position.x - position.x;
          const dy = animal.position.y - position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= radiusSq) {
            result.push(animal);
          }
        });
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

    // Death by starvation
    if (AnimalNeeds.isStarving(animal)) {
      this.killAnimal(animal.id, "starvation");
      return;
    }

    // Death by dehydration
    if (AnimalNeeds.isDehydrated(animal)) {
      this.killAnimal(animal.id, "dehydration");
      return;
    }

    // Death by old age
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
  private handleAnimalHunted(animalId: string, hunterId: string): void {
    const animal = this.animals.get(animalId);
    if (!animal) return;

    const config = getAnimalConfig(animal.type);
    if (!config) return;

    simulationEvents.emit(GameEventNames.ANIMAL_HUNTED, {
      animalId,
      hunterId,
      type: animal.type,
      position: animal.position,
      foodValue: config.foodValue,
      genes: animal.genes,
    });

    this.killAnimal(animalId, "hunted");
  }

  /**
   * Consume a resource
   */
  private consumeResource(resourceId: string, consumerId: string): void {
    if (this.worldResourceSystem) {
      // Delegate to WorldResourceSystem
      this.worldResourceSystem.harvestResource?.(resourceId, consumerId);
    }
  }

  /**
   * Clean up dead animals
   */
  private cleanupDeadAnimals(): void {
    const toRemove: string[] = [];

    this.animals.forEach((animal, id) => {
      if (animal.isDead) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => {
      const animal = this.animals.get(id);
      if (animal) {
        const cellKey = this.getGridCell(animal.position);
        this.spatialGrid.get(cellKey)?.delete(id);
      }
      this.animals.delete(id);
    });

    if (toRemove.length > 0) {
      logger.info(`🧹 Cleaned up ${toRemove.length} dead animals`);
    }
  }

  /**
   * Clean caches
   */
  private cleanCaches(): void {
    const now = Date.now();

    for (const [key, cache] of Array.from(this.resourceSearchCache.entries())) {
      if (now - cache.timestamp > this.CACHE_DURATION) {
        this.resourceSearchCache.delete(key);
      }
    }

    for (const [key, cache] of Array.from(this.threatSearchCache.entries())) {
      if (now - cache.timestamp > this.CACHE_DURATION) {
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
}
