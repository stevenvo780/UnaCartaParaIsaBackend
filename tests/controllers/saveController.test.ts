import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../../src/infrastructure/services/storage/storageService.ts', () => ({
  storageService: {
    isHealthy: vi.fn(),
    listSaves: vi.fn(),
    getSave: vi.fn(),
    saveGame: vi.fn(),
    deleteSave: vi.fn(),
  },
}));

import { saveController } from "../../src/infrastructure/controllers/saveController.ts";
import { storageService } from "../../src/infrastructure/services/storage/storageService.ts";

describe('SaveController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      params: {},
      body: {},
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('healthCheck', () => {
    it('debe retornar estado saludable', async () => {
      const mockStatus = { status: 'ok', timestamp: Date.now(), storage: 'local' };
      vi.mocked(storageService.isHealthy).mockResolvedValue(mockStatus);

      await saveController.healthCheck(mockReq as Request, mockRes as Response);

      expect(storageService.isHealthy).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockStatus);
    });

    it('debe manejar errores', async () => {
      vi.mocked(storageService.isHealthy).mockRejectedValue(new Error('Storage error'));

      await saveController.healthCheck(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Storage unavailable',
      });
    });
  });

  describe('listSaves', () => {
    it('debe retornar lista de saves', async () => {
      const mockSaves = [
        { id: 'save_1', timestamp: 1000, gameTime: 100, stats: {}, size: 100, modified: '2024-01-01' },
      ];
      vi.mocked(storageService.listSaves).mockResolvedValue(mockSaves);

      await saveController.listSaves(mockReq as Request, mockRes as Response);

      expect(storageService.listSaves).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ saves: mockSaves });
    });

    it('debe manejar errores', async () => {
      vi.mocked(storageService.listSaves).mockRejectedValue(new Error('List error'));

      await saveController.listSaves(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to list saves' });
    });
  });

  describe('getSave', () => {
    it('debe retornar save existente', async () => {
      const mockSave = { timestamp: 1000, gameTime: 100, stats: {} };
      mockReq.params = { id: 'save_1' };
      vi.mocked(storageService.getSave).mockResolvedValue(mockSave);

      await saveController.getSave(mockReq as Request, mockRes as Response);

      expect(storageService.getSave).toHaveBeenCalledWith('save_1');
      expect(mockRes.json).toHaveBeenCalledWith({ data: mockSave });
    });

    it('debe retornar 404 si el save no existe', async () => {
      mockReq.params = { id: 'save_999' };
      vi.mocked(storageService.getSave).mockResolvedValue(null);

      await saveController.getSave(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Save not found' });
    });

    it('debe manejar errores', async () => {
      mockReq.params = { id: 'save_1' };
      vi.mocked(storageService.getSave).mockRejectedValue(new Error('Get error'));

      await saveController.getSave(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to read save' });
    });
  });

  describe('saveGame', () => {
    it('debe guardar juego válido', async () => {
      const mockSaveData = { timestamp: 1000, gameTime: 100, stats: {} };
      mockReq.body = mockSaveData;
      const mockResult = { saveId: 'save_1000', size: 500 };
      vi.mocked(storageService.saveGame).mockResolvedValue(mockResult);

      await saveController.saveGame(mockReq as Request, mockRes as Response);

      expect(storageService.saveGame).toHaveBeenCalledWith(mockSaveData);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        saveId: mockResult.saveId,
        size: mockResult.size,
        timestamp: mockSaveData.timestamp,
      });
    });

    it('debe retornar 400 si falta timestamp', async () => {
      mockReq.body = { gameTime: 100 };

      await saveController.saveGame(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid save data format' });
    });

    it('debe retornar 400 si el body está vacío', async () => {
      mockReq.body = null;

      await saveController.saveGame(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid save data format' });
    });

    it('debe manejar errores', async () => {
      mockReq.body = { timestamp: 1000, gameTime: 100 };
      vi.mocked(storageService.saveGame).mockRejectedValue(new Error('Save error'));

      await saveController.saveGame(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to save game' });
    });
  });

  describe('deleteSave', () => {
    it('debe eliminar save existente', async () => {
      mockReq.params = { id: 'save_1' };
      vi.mocked(storageService.deleteSave).mockResolvedValue(true);

      await saveController.deleteSave(mockReq as Request, mockRes as Response);

      expect(storageService.deleteSave).toHaveBeenCalledWith('save_1');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Save deleted' });
    });

    it('debe retornar 404 si el save no existe', async () => {
      mockReq.params = { id: 'save_999' };
      vi.mocked(storageService.deleteSave).mockResolvedValue(false);

      await saveController.deleteSave(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Save not found' });
    });

    it('debe manejar errores', async () => {
      mockReq.params = { id: 'save_1' };
      vi.mocked(storageService.deleteSave).mockRejectedValue(new Error('Delete error'));

      await saveController.deleteSave(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to delete save' });
    });
  });
});

