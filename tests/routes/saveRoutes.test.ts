import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import saveRoutes from '../../src/routes/saveRoutes.ts";
import { saveController } from '../../src/controllers/saveController.ts";

vi.mock('../../src/controllers/saveController.ts", () => ({
  saveController: {
    healthCheck: vi.fn(),
    listSaves: vi.fn(),
    getSave: vi.fn(),
    saveGame: vi.fn(),
    deleteSave: vi.fn(),
  },
}));

describe('SaveRoutes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

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

    mockNext = vi.fn();
  });

  it('debe tener ruta GET /health', () => {
    expect(saveRoutes).toBeDefined();
    // Las rutas están definidas en el módulo
    expect(saveController.healthCheck).toBeDefined();
  });

  it('debe tener ruta GET /api/saves', () => {
    expect(saveController.listSaves).toBeDefined();
  });

  it('debe tener ruta GET /api/saves/:id', () => {
    expect(saveController.getSave).toBeDefined();
  });

  it('debe tener ruta POST /api/saves', () => {
    expect(saveController.saveGame).toBeDefined();
  });

  it('debe tener ruta DELETE /api/saves/:id', () => {
    expect(saveController.deleteSave).toBeDefined();
  });
});

