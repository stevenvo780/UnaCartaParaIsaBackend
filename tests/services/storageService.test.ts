import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { StorageService } from "../../src/infrastructure/services/storage/storageService.ts";

vi.mock('fs/promises');
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(),
}));
vi.mock('ssh2-sftp-client', () => ({
  default: vi.fn(),
}));
vi.mock('../../src/config/config.ts', () => ({
  CONFIG: {
    USE_LOCAL_STORAGE: true,
    LOCAL_SAVES_PATH: '/tmp/test-saves',
    NAS: {
      ENABLED: false,
      HOST: '',
      PORT: 22,
      USERNAME: '',
      PASSWORD: '',
      BACKUP_PATH: '',
    },
  },
}));

describe('StorageService', () => {
  let storageService: StorageService;
  const mockLocalPath = '/tmp/test-saves';

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new StorageService();
  });

  describe('isHealthy', () => {
    it('debe retornar estado saludable con almacenamiento local', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      
      const result = await storageService.isHealthy();
      
      expect(result.status).toBe('ok');
      expect(result.storage).toBe('local');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('listSaves', () => {
    it('debe listar saves locales', async () => {
      const mockFiles = ['save_1000.json', 'save_2000.json', 'other.txt'];
      const mockSaveData1 = { timestamp: 1000, gameTime: 100, stats: {} };
      const mockSaveData2 = { timestamp: 2000, gameTime: 200, stats: {} };
      
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockSaveData1))
        .mockResolvedValueOnce(JSON.stringify(mockSaveData2));
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 100, mtime: new Date('2024-01-01') } as never)
        .mockResolvedValueOnce({ size: 200, mtime: new Date('2024-01-02') } as never);
      
      const saves = await storageService.listSaves();
      
      expect(saves).toHaveLength(2);
      expect(saves[0].id).toBe('save_2000');
      expect(saves[1].id).toBe('save_1000');
    });

    it('debe retornar array vacío si no hay saves', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([]);
      
      const saves = await storageService.listSaves();
      
      expect(saves).toEqual([]);
    });

    it('debe saltar saves inválidos y continuar', async () => {
      const mockFiles = ['save_1000.json', 'save_2000.json'];
      const validData = { timestamp: 2000, gameTime: 200, stats: {} };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('INVALID_JSON')
        .mockResolvedValueOnce(JSON.stringify(validData));
      vi.mocked(fs.stat)
        .mockResolvedValue({ size: 50, mtime: new Date('2024-01-01') } as never)
        .mockResolvedValue({ size: 60, mtime: new Date('2024-01-02') } as never);

      const saves = await storageService.listSaves();

      expect(saves).toHaveLength(1);
      expect(saves[0].id).toBe('save_2000');
    });

    it('debe manejar error al crear directorio y continuar', async () => {
      const mockFiles = ['save_1000.json'];
      const mockSaveData = { timestamp: 1000, gameTime: 100, stats: {} };

      vi.mocked(fs.mkdir).mockRejectedValue(new Error('EEXIST'));
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSaveData));
      vi.mocked(fs.stat).mockResolvedValue({ size: 10, mtime: new Date() } as never);

      const saves = await storageService.listSaves();

      expect(saves).toHaveLength(1);
    });
  });

  describe('getSave', () => {
    it('debe obtener save local existente', async () => {
      const mockSaveData = { timestamp: 1000, gameTime: 100, stats: {} };
      
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSaveData));
      
      const save = await storageService.getSave('save_1000');
      
      expect(save).toEqual(mockSaveData);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockLocalPath, 'save_1000.json'),
        'utf-8'
      );
    });

    it('debe retornar null si el save no existe', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      
      const save = await storageService.getSave('save_nonexistent');
      
      expect(save).toBeNull();
    });

    it('debe retornar null si el JSON es inválido', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('invalid-json');

      const save = await storageService.getSave('save_invalid');

      expect(save).toBeNull();
    });
  });

  describe('saveGame', () => {
    it('debe guardar juego en almacenamiento local', async () => {
      const mockSaveData = { timestamp: 1000, gameTime: 100, stats: {} };
      
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: 500 } as never);
      
      const result = await storageService.saveGame(mockSaveData);
      
      expect(result.saveId).toBe('save_1000');
      expect(result.size).toBe(500);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('debe propagar errores de escritura', async () => {
      const mockSaveData = { timestamp: 1000, gameTime: 100, stats: {} };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('disk full'));

      await expect(storageService.saveGame(mockSaveData)).rejects.toThrow('disk full');
    });
  });

  describe('deleteSave', () => {
    it('debe eliminar save local existente', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      
      const result = await storageService.deleteSave('save_1000');
      
      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(mockLocalPath, 'save_1000.json')
      );
    });

    it('debe retornar false si el save no existe', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockRejectedValue(new Error('File not found'));
      
      const result = await storageService.deleteSave('save_nonexistent');
      
      expect(result).toBe(false);
    });
  });
});

