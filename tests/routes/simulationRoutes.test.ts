import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { simulationRunner } from "../../src/domain/simulation/core/index.ts";
import { storageService } from "../../src/infrastructure/services/storageService.ts";

vi.mock('../../src/simulation/index.ts", () => ({
  simulationRunner: {
    getSnapshot: vi.fn(),
    enqueueCommand: vi.fn(),
  },
}));

vi.mock('../../src/services/storageService.ts", () => ({
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

