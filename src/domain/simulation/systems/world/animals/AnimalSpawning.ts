import { logger } from "@/infrastructure/utils/logger";
import type {
  Animal,
  AnimalType,
  AnimalGenes,
} from "@/shared/types/simulation/animals";
import type { TerrainTile } from "../generation/types";
import { getAnimalConfig, getAnimalsForBiome } from "../config/AnimalConfigs";
import { AnimalGenetics } from "./AnimalGenetics";
import { simulationEvents, GameEventType } from "../../../core/events";
import { AnimalState } from "../../../../../shared/constants/AnimalEnums";
import { BiomeType } from '../../../../../shared/constants/BiomeEnums';

export class AnimalSpawning {
  private static nextAnimalId = 1;
  private static spawnedChunks = new Set<string>();

  /**
   * Spawn animals for a specific chunk (lazy loading).
   * This is the ONLY spawn method - animals are created when chunks become visible.
   *
   * Optimizations:
   * - Deduplication via spawnedChunks Set
   * - Larger sample step for fewer spawn checks
   * - Cached biome configs lookup
   * - Reduced group sizes for balanced population
   */
  public static spawnAnimalsInChunk(
    chunkCoords: { x: number; y: number },
    chunkBounds: { x: number; y: number; width: number; height: number },
    onSpawn: (animal: Animal) => void,
    tiles?: TerrainTile[][],
  ): number {
    const chunkKey = `${chunkCoords.x},${chunkCoords.y}`;
    if (this.spawnedChunks.has(chunkKey)) {
      return 0;
    }
    this.spawnedChunks.add(chunkKey);

    const { x: chunkX, y: chunkY, width, height } = chunkBounds;
    let spawned = 0;

    const sampleStep = 128;

    const tileSize =
      tiles && tiles[0]?.length > 0 ? width / tiles[0].length : 64;

    for (let x = chunkX; x < chunkX + width; x += sampleStep) {
      for (let y = chunkY; y < chunkY + height; y += sampleStep) {
        let biome = "grassland";
        let isWalkable = true;

        if (tiles) {
          const localX = Math.floor((x - chunkX) / tileSize);
          const localY = Math.floor((y - chunkY) / tileSize);

          if (
            localY >= 0 &&
            localY < tiles.length &&
            localX >= 0 &&
            localX < tiles[0].length
          ) {
            const tile = tiles[localY][localX];
            biome = tile.biome;
            isWalkable = tile.isWalkable;
          }
        }

        const animalConfigs = getAnimalsForBiome(biome);

        for (const config of animalConfigs) {
          if (config.isAquatic && isWalkable && biome !== BiomeType.WETLAND) continue;
          if (!config.isAquatic && !isWalkable) continue;

          const chunkSpawnProb = config.spawnProbability * 0.1;

          if (Math.random() < chunkSpawnProb) {
            const groupSize = Math.random() < 0.3 ? 2 : 1;

            for (let i = 0; i < groupSize; i++) {
              const offsetX = (Math.random() - 0.5) * 80;
              const offsetY = (Math.random() - 0.5) * 80;

              const animal = this.createAnimal(
                config.type,
                { x: x + offsetX, y: y + offsetY },
                biome,
              );

              if (animal) {
                onSpawn(animal);
                spawned++;
              }
            }
          }
        }
      }
    }

    return spawned;
  }

  /**
   * Clear spawned chunks cache (for world reset)
   */
  public static clearSpawnedChunks(): void {
    this.spawnedChunks.clear();
  }

  /**
   * Check if a chunk has been processed for animal spawning
   */
  public static isChunkSpawned(x: number, y: number): boolean {
    return this.spawnedChunks.has(`${x},${y}`);
  }

  /**
   * Mark a chunk as spawned without actually spawning animals
   * Useful when loading saved game state
   */
  public static markChunkAsSpawned(x: number, y: number): void {
    this.spawnedChunks.add(`${x},${y}`);
  }

  /**
   * Create a single animal
   */
  public static createAnimal(
    type: string,
    position: { x: number; y: number },
    biome: string,
    genes?: AnimalGenes,
    generation = 0,
    parentIds: [string | null, string | null] = [null, null],
  ): Animal | null {
    const config = getAnimalConfig(type);
    if (!config) {
      logger.error(`❌ No config for animal type: ${type}`);
      return null;
    }

    const id = `animal_${type}_${this.nextAnimalId++}`;
    const now = Date.now();
    const animalGenes = genes || AnimalGenetics.generateRandomGenes();

    const animal: Animal = {
      id,
      type: type as AnimalType,
      position: { ...position },
      state: AnimalState.IDLE,
      needs: {
        hunger: 100,
        thirst: 100,
        fear: 0,
        reproductiveUrge: generation > 0 ? 30 : 0,
      },
      genes: animalGenes,
      generation,
      parentIds,
      health: config.maxHealth * animalGenes.health,
      age: 0,
      lastReproduction: generation > 0 ? now - 60000 : now,
      spawnedAt: now,
      targetPosition: null,
      currentTarget: null,
      fleeTarget: null,
      biome,
      isDead: false,
    };

    simulationEvents.emit(GameEventType.ANIMAL_SPAWNED, {
      animalId: id,
      type,
      position,
      biome,
    });

    return animal;
  }

  /**
   * Check if position is too close to existing animals of same type
   */
  public static isTooCloseToSameType(
    position: { x: number; y: number },
    type: string,
    existingAnimals: Animal[],
    minDistance: number,
  ): boolean {
    return existingAnimals.some((existing) => {
      if (existing.type !== type) return false;

      const dx = existing.position.x - position.x;
      const dy = existing.position.y - position.y;
      const distSq = dx * dx + dy * dy;

      return distSq < minDistance * minDistance;
    });
  }
}
