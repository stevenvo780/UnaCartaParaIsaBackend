import { Request, Response } from "express";

import { logger } from "../utils/logger";
import { HttpStatusCode } from "../../shared/constants/HttpStatusCodes";

/**
 * Request payload for chunk generation endpoint.
 */
interface ChunkRequest {
  x?: number;
  y?: number;
  seed?: string | number;
  width?: number;
  height?: number;
  tileSize?: number;
}

/**
 * Chunk generation constants.
 * Centralized to ensure consistency and prevent magic numbers.
 */
const CHUNK_CONSTANTS = {
  DEFAULT_CHUNK_SIZE: 100,
  DEFAULT_TILE_SIZE: 64,
  MAX_CHUNK_SIZE: 1000,
  MIN_CHUNK_SIZE: 16,
  MIN_TILE_SIZE: 16,
  MAX_TILE_SIZE: 256,
  MAX_SEED_LENGTH: 100,
  CHUNK_SIZE: 16,
} as const;

import { container } from "../../config/container";
import { TYPES } from "../../config/Types";
import { WorldGenerationService } from "../../domain/world/worldGenerationService";
import { AnimalSystem } from "../../domain/simulation/systems/world/animals/AnimalSystem";
import { WorldResourceSystem } from "../../domain/simulation/systems/world/WorldResourceSystem";

/**
 * Controller for world generation operations.
 *
 * Handles HTTP endpoints for terrain chunk generation. Automatically spawns
 * animals and resources for generated chunks. Validates chunk parameters
 * and enforces size limits to prevent resource exhaustion.
 *
 * @remarks
 * Chunk generation is CPU-intensive. Consider rate limiting in production.
 * Generated chunks are cached by the WorldGenerationService.
 */
export class WorldController {
  /**
   * Generates a terrain chunk at the specified coordinates.
   *
   * @param req - Express request with chunk parameters (x, y, seed, width, height, tileSize)
   * @param res - Express response with generated chunk data
   *
   * @remarks
   * Side effects:
   * - Spawns animals in the chunk via AnimalSystem
   * - Spawns resources in the chunk via WorldResourceSystem
   * - May write to storage if chunk caching is enabled
   */
  async generateChunk(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as ChunkRequest;
      logger.info(
        `🗺️ [WorldController] generateChunk request: x=${body.x}, y=${body.y}`,
      );

      const worldGenerationService = container.get<WorldGenerationService>(
        TYPES.WorldGenerationService,
      );
      const { x, y, seed, width, height, tileSize } = body;

      if (typeof x !== "number" || typeof y !== "number") {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Invalid request: x and y must be numbers",
        });
        return;
      }

      const validatedWidth = Math.max(
        CHUNK_CONSTANTS.MIN_CHUNK_SIZE,
        Math.min(
          CHUNK_CONSTANTS.MAX_CHUNK_SIZE,
          width ?? CHUNK_CONSTANTS.DEFAULT_CHUNK_SIZE,
        ),
      );
      const validatedHeight = Math.max(
        CHUNK_CONSTANTS.MIN_CHUNK_SIZE,
        Math.min(
          CHUNK_CONSTANTS.MAX_CHUNK_SIZE,
          height ?? CHUNK_CONSTANTS.DEFAULT_CHUNK_SIZE,
        ),
      );
      const validatedTileSize = Math.max(
        CHUNK_CONSTANTS.MIN_TILE_SIZE,
        Math.min(
          CHUNK_CONSTANTS.MAX_TILE_SIZE,
          tileSize ?? CHUNK_CONSTANTS.DEFAULT_TILE_SIZE,
        ),
      );

      const validatedSeed =
        typeof seed === "string" && seed.length > 0
          ? seed.slice(0, CHUNK_CONSTANTS.MAX_SEED_LENGTH)
          : typeof seed === "number"
            ? seed
            : "default";

      const chunk = await worldGenerationService.generateChunk(x, y, {
        seed: validatedSeed,
        width: validatedWidth,
        height: validatedHeight,
        tileSize: validatedTileSize,
        noise: {
          temperature: {
            scale: 0.01,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2,
          },
          moisture: {
            scale: 0.01,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2,
          },
          elevation: {
            scale: 0.01,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2,
          },
        },
      });

      try {
        const animalSystem = container.get<AnimalSystem>(TYPES.AnimalSystem);
        const pixelWidth = CHUNK_CONSTANTS.CHUNK_SIZE * validatedTileSize;
        const pixelHeight = CHUNK_CONSTANTS.CHUNK_SIZE * validatedTileSize;
        const worldX = x * pixelWidth;
        const worldY = y * pixelHeight;

        const spawnedCount = animalSystem.spawnAnimalsForChunk(
          { x, y },
          {
            x: worldX,
            y: worldY,
            width: pixelWidth,
            height: pixelHeight,
          },
          chunk,
        );

        if (spawnedCount > 0) {
          logger.info(
            `🐾 [WorldController] Spawned ${spawnedCount} animals in chunk (${x}, ${y})`,
          );
        }

        const worldResourceSystem = container.get<WorldResourceSystem>(
          TYPES.WorldResourceSystem,
        );
        worldResourceSystem.spawnResourcesForChunk(
          { x, y },
          {
            x: worldX,
            y: worldY,
            width: pixelWidth,
            height: pixelHeight,
          },
          chunk,
        );
      } catch (error) {
        logger.warn(
          `Failed to spawn entities for chunk ${x},${y}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      res.json(chunk);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Error generating chunk:", errorMessage);
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: "Failed to generate chunk",
      });
    }
  }
}

export const worldController = new WorldController();
