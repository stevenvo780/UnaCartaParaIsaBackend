import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';

const mockGenerateChunk = vi.fn();
const mockSpawnAnimalsForChunk = vi.fn();

vi.mock('../../src/infrastructure/services/world/worldGenerationService.ts', () => ({
  WorldGenerationService: vi.fn().mockImplementation(() => ({
    generateChunk: mockGenerateChunk,
  })),
}));

vi.mock('../../src/config/container.ts', () => {
  // Importar TYPES dentro del mock factory usando require
  const { TYPES } = require('../../src/config/Types');
  
  return {
    container: {
      get: vi.fn((type: symbol) => {
        // Usar Symbol.keyFor para comparar símbolos de forma más confiable
        const typeKey = Symbol.keyFor(type);
        const worldGenKey = Symbol.keyFor(TYPES.WorldGenerationService);
        const animalSystemKey = Symbol.keyFor(TYPES.AnimalSystem);
        
        if (typeKey === worldGenKey) {
          return {
            generateChunk: mockGenerateChunk,
          };
        }
        if (typeKey === animalSystemKey) {
          return {
            spawnAnimalsForChunk: mockSpawnAnimalsForChunk,
          };
        }
        // Por defecto, devolver el servicio de generación
        return {
          generateChunk: mockGenerateChunk,
        };
      }),
    },
  };
});

import { worldController } from "../../src/infrastructure/controllers/worldController.ts";

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
      mockGenerateChunk.mockResolvedValue(mockChunk);

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(mockGenerateChunk).toHaveBeenCalledWith(0, 0, {
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
      mockGenerateChunk.mockResolvedValue(mockChunk);

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(mockGenerateChunk).toHaveBeenCalledWith(1, 2, {
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
      mockGenerateChunk.mockRejectedValue(new Error('Generation error'));

      await worldController.generateChunk(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to generate chunk' });
    });
  });
});

