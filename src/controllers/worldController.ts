import { Request, Response } from 'express';
import { worldGenerationService } from '../services/worldGenerationService.js';

export class WorldController {
  async generateChunk(req: Request, res: Response) {
    try {
      const { x, y, seed, width, height, tileSize } = req.body;
      
      const chunk = await worldGenerationService.generateChunk(x, y, {
        seed: seed || 'default',
        width: width || 100,
        height: height || 100,
        tileSize: tileSize || 64
      });

      res.json(chunk);
    } catch (error) {
      console.error('Error generating chunk:', error);
      res.status(500).json({ error: 'Failed to generate chunk' });
    }
  }
}

export const worldController = new WorldController();
