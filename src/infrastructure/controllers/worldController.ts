import { Request, Response } from "express";
import { worldGenerationService } from "../services/world/worldGenerationService.js";

export class WorldController {
  async generateChunk(req: Request, res: Response) {
    try {
      const { x, y, seed, width, height, tileSize } = req.body;

      const chunk = await worldGenerationService.generateChunk(x, y, {
        seed: seed || "default",
        width: width || 100,
        height: height || 100,
        tileSize: tileSize || 64,
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
      console.error("Error generating chunk:", error);
      res.status(500).json({ error: "Failed to generate chunk" });
    }
  }
}

export const worldController = new WorldController();
