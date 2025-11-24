import { Request, Response } from "express";
import { worldGenerationService } from "../services/world/worldGenerationService.js";
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

export class WorldController {
  async generateChunk(req: Request, res: Response): Promise<void> {
    try {
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
