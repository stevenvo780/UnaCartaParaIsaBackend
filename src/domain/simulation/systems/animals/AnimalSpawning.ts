import { logger } from "@/infrastructure/utils/logger";
import type {
  Animal,
  AnimalType,
  AnimalGenes,
} from "../../../types/simulation/animals";
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
    return spawned;
  }

  public static spawnAnimalsInChunk(
    chunkCoords: { x: number; y: number },
    chunkBounds: { x: number; y: number; width: number; height: number },
    onSpawn: (animal: Animal) => void,
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
        // Simple biome detection (could be improved with actual biome map)
        const biomeNoise = Math.sin(x * 0.02) + Math.cos(y * 0.02);
        let biome = "grassland";
        if (biomeNoise > 0.6) biome = "mystical";
        else if (biomeNoise > 0.3) biome = "forest";
        else if (biomeNoise < -0.3) biome = "wetland";
        else if (biomeNoise < -0.6) biome = "mountainous";

        const animalConfigs = getAnimalsForBiome(biome);

        for (const config of animalConfigs) {
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
