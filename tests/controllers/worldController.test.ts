import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { worldController } from '../../src/controllers/worldController.ts";
import { worldGenerationService } from '../../src/services/worldGenerationService.ts";

vi.mock('../../src/services/worldGenerationService.ts", () => ({
  worldGenerationService: {
    generateChunk: vi.fn(),
  },
}));

describe('WorldController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      body: {},
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('generateChunk', () => {
    it('debe generar chunk con parámetros proporcionados', async () => {
      const mockChunk = [[{ x: 0, y: 0, biome: 'grassland' }]];
      mockReq.body = {
        x: 0,
        y: 0,
        seed: 'test-seed',
        width: 100,
        height: 100,
        tileSize: 64,
      };
      vi.mocked(worldGenerationService.generateChunk).mockResolvedValue(mockChunk);

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(worldGenerationService.generateChunk).toHaveBeenCalledWith(0, 0, {
        seed: 'test-seed',
        width: 100,
        height: 100,
        tileSize: 64,
        noise: {
          temperature: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          moisture: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          elevation: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockChunk);
    });

    it('debe usar valores por defecto cuando faltan parámetros', async () => {
      const mockChunk = [[{ x: 0, y: 0, biome: 'grassland' }]];
      mockReq.body = {
        x: 1,
        y: 2,
      };
      vi.mocked(worldGenerationService.generateChunk).mockResolvedValue(mockChunk);

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(worldGenerationService.generateChunk).toHaveBeenCalledWith(1, 2, {
        seed: 'default',
        width: 100,
        height: 100,
        tileSize: 64,
        noise: {
          temperature: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          moisture: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          elevation: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockChunk);
    });

    it('debe manejar errores', async () => {
      mockReq.body = { x: 0, y: 0 };
      vi.mocked(worldGenerationService.generateChunk).mockRejectedValue(new Error('Generation error'));

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to generate chunk' });
    });
  });
});

