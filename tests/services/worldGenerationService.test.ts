import { describe, it, expect, beforeEach } from 'vitest';
import { WorldGenerationService } from "../../src/domain/simulation/systems/world/generation/worldGenerationService.ts";

describe('WorldGenerationService', () => {
  let service: WorldGenerationService;

  beforeEach(() => {
    service = new WorldGenerationService();
  });

  describe('generateChunk', () => {
    it('debe generar chunk con configuración básica', async () => {
      const chunk = await service.generateChunk(0, 0, {
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

      expect(chunk).toBeDefined();
      expect(Array.isArray(chunk)).toBe(true);
      expect(chunk.length).toBe(16); // chunkSize
      expect(chunk[0].length).toBe(16);
    });

    it('debe generar tiles con propiedades correctas', async () => {
      const chunk = await service.generateChunk(0, 0, {
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

      const tile = chunk[0][0];
      expect(tile).toHaveProperty('x');
      expect(tile).toHaveProperty('y');
      expect(tile).toHaveProperty('biome');
      expect(tile).toHaveProperty('temperature');
      expect(tile).toHaveProperty('moisture');
      expect(tile).toHaveProperty('elevation');
      expect(tile).toHaveProperty('isWalkable');
      expect(tile).toHaveProperty('assets');
    });

    it('debe generar chunks diferentes para coordenadas diferentes', async () => {
      const chunk1 = await service.generateChunk(0, 0, {
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

      const chunk2 = await service.generateChunk(1, 1, {
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

      expect(chunk1[0][0].x).not.toBe(chunk2[0][0].x);
      expect(chunk1[0][0].y).not.toBe(chunk2[0][0].y);
    });

    it('debe generar chunks determinísticos con la misma seed', async () => {
      const config = {
        seed: 'deterministic-seed',
        width: 100,
        height: 100,
        tileSize: 64,
        noise: {
          temperature: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          moisture: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          elevation: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
        },
      };

      const chunk1 = await service.generateChunk(0, 0, config);
      const chunk2 = await service.generateChunk(0, 0, config);

      expect(chunk1[0][0].biome).toBe(chunk2[0][0].biome);
      expect(chunk1[0][0].temperature).toBe(chunk2[0][0].temperature);
    });
  });

  describe('generateWorld', () => {
    it('debe retornar objeto con config y status', async () => {
      const config = {
        seed: 'test-seed',
        width: 100,
        height: 100,
        tileSize: 64,
        noise: {
          temperature: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          moisture: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
          elevation: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2 },
        },
      };

      const result = await service.generateWorld(config);

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('generating');
    });
  });
});

