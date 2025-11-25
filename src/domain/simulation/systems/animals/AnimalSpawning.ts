import { logger } from "@/infrastructure/utils/logger";
import type {
  Animal,
  AnimalType,
  AnimalGenes,
} from "../../../types/simulation/animals";
import type { TerrainTile } from "../../../world/generation/types";
import {
  getAnimalConfig,
  getAnimalsForBiome,
} from "../../../../infrastructure/services/world/config/AnimalConfigs";
import { AnimalGenetics } from "./AnimalGenetics";
import { simulationEvents, GameEventNames } from "../../core/events";

export class AnimalSpawning {
  private static nextAnimalId = 1;
  private static spawnedChunks = new Set<string>();

  public static spawnAnimalsInWorld(
    worldWidth: number,
    worldHeight: number,
    tileSize: number,
    biomeMap: string[][],
    onSpawn: (animal: Animal) => void,
  ): number {
    const startTime = performance.now();
    let spawned = 0;

    if (!biomeMap || biomeMap.length === 0) {
      logger.warn("⚠️ No biomeMap, skipping animal spawn");
      return 0;
    }

    const sampleStep = 96;

    for (let x = 0; x < worldWidth; x += sampleStep) {
      for (let y = 0; y < worldHeight; y += sampleStep) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);

        if (
          tileY >= 0 &&
          tileY < biomeMap.length &&
          tileX >= 0 &&
          tileX < biomeMap[0].length
        ) {
          const biome = biomeMap[tileY][tileX];
          const animalConfigs = getAnimalsForBiome(biome);

          for (const config of animalConfigs) {
            if (Math.random() < config.spawnProbability) {
              const groupSize =
                config.groupSize.min +
                Math.floor(
                  Math.random() *
                    (config.groupSize.max - config.groupSize.min + 1),
                );

              for (let i = 0; i < groupSize; i++) {
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;

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
    }

    const duration = performance.now() - startTime;
    logger.info(`🐰 Spawned ${spawned} animals in ${duration.toFixed(2)}ms`);

    const CHUNK_PIXEL_SIZE = 16 * tileSize;
    const chunksX = Math.ceil(worldWidth / CHUNK_PIXEL_SIZE);
    const chunksY = Math.ceil(worldHeight / CHUNK_PIXEL_SIZE);

    for (let cx = 0; cx < chunksX; cx++) {
      for (let cy = 0; cy < chunksY; cy++) {
        this.spawnedChunks.add(`${cx},${cy}`);
      }
    }

    return spawned;
  }

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

    for (let x = chunkX; x < chunkX + width; x += sampleStep) {
      for (let y = chunkY; y < chunkY + height; y += sampleStep) {
        let biome = "grassland";
        let isWalkable = true;

        if (tiles) {
          const tileSize = width / tiles[0].length;
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
        } else {
          // Fallback to noise if no tiles provided
          const biomeNoise = Math.sin(x * 0.02) + Math.cos(y * 0.02);
          if (biomeNoise > 0.6) biome = "mystical";
          else if (biomeNoise > 0.3) biome = "forest";
          else if (biomeNoise < -0.3) biome = "wetland";
          else if (biomeNoise < -0.6) biome = "mountainous";
        }

        const animalConfigs = getAnimalsForBiome(biome);

        for (const config of animalConfigs) {
          // Skip if terrain doesn't match aquatic requirement
          if (config.isAquatic) {
            // Aquatic animals need non-walkable terrain (water)
            // Or explicit water biome check if isWalkable is not enough
            if (isWalkable && biome !== "wetland") continue;
          } else {
            // Land animals need walkable terrain
            if (!isWalkable) continue;
          }

          const chunkSpawnProb = config.spawnProbability * 0.5;

          if (Math.random() < chunkSpawnProb) {
            const groupSize = Math.max(
              1,
              config.groupSize.min +
                Math.floor(
                  Math.random() *
                    (config.groupSize.max - config.groupSize.min + 1),
                ) -
                1,
            );

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

    if (spawned > 0) {
      logger.info(
        `🐰 Spawned ${spawned} animals in chunk (${chunkX}, ${chunkY})`,
      );
    }
    return spawned;
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
      state: "idle",
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

    simulationEvents.emit(GameEventNames.ANIMAL_SPAWNED, {
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
