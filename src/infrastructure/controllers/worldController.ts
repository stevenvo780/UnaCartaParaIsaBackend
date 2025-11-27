import { Request, Response } from "express";

import { logger } from "../utils/logger.js";

interface ChunkRequest {
  x?: number;
  y?: number;
  seed?: string | number;
  width?: number;
  height?: number;
  tileSize?: number;
}

const DEFAULT_CHUNK_SIZE = 100;
const DEFAULT_TILE_SIZE = 64;
const MAX_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 16;

import { container } from "../../config/container";
import { TYPES } from "../../config/Types";
import { WorldGenerationService } from "../services/world/worldGenerationService";
import { AnimalSystem } from "../../domain/simulation/systems/AnimalSystem";
import { WorldResourceSystem } from "../../domain/simulation/systems/WorldResourceSystem";

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
      const worldGenerationService = container.get<WorldGenerationService>(
        TYPES.WorldGenerationService,
      );
      const body = req.body as ChunkRequest;
      const { x, y, seed, width, height, tileSize } = body;

      if (typeof x !== "number" || typeof y !== "number") {
        res.status(400).json({
          error: "Invalid request: x and y must be numbers",
        });
        return;
      }

      const validatedWidth = Math.max(
        MIN_CHUNK_SIZE,
        Math.min(MAX_CHUNK_SIZE, width ?? DEFAULT_CHUNK_SIZE),
      );
      const validatedHeight = Math.max(
        MIN_CHUNK_SIZE,
        Math.min(MAX_CHUNK_SIZE, height ?? DEFAULT_CHUNK_SIZE),
      );
      const validatedTileSize = Math.max(
        16,
        Math.min(256, tileSize ?? DEFAULT_TILE_SIZE),
      );

      const validatedSeed =
        typeof seed === "string" && seed.length > 0
          ? seed.slice(0, 100) // Limit seed length
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
        const CHUNK_SIZE = 16;
        const pixelWidth = CHUNK_SIZE * validatedTileSize;
        const pixelHeight = CHUNK_SIZE * validatedTileSize;
        const worldX = x * pixelWidth;
        const worldY = y * pixelHeight;

        animalSystem.spawnAnimalsForChunk(
          { x, y },
          {
            x: worldX,
            y: worldY,
            width: pixelWidth,
            height: pixelHeight,
          },
          chunk,
        );

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
      res.status(500).json({ error: "Failed to generate chunk" });
    }
  }
}

export const worldController = new WorldController();
