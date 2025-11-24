import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { simulationRunner } from '../../src/simulation/index.js';
import { storageService } from '../../src/services/storageService.js';

vi.mock('../../src/simulation/index.js', () => ({
  simulationRunner: {
    getSnapshot: vi.fn(),
    enqueueCommand: vi.fn(),
  },
}));

vi.mock('../../src/services/storageService.js', () => ({
  storageService: {
    saveGame: vi.fn(),
  },
}));

describe('SimulationRoutes', () => {
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

  it('debe tener simulationRunner definido', () => {
    expect(simulationRunner).toBeDefined();
    expect(simulationRunner.getSnapshot).toBeDefined();
    expect(simulationRunner.enqueueCommand).toBeDefined();
  });

  it('debe tener storageService definido', () => {
    expect(storageService).toBeDefined();
    expect(storageService.saveGame).toBeDefined();
  });
});

