import { describe, it, expect } from 'vitest';
import worldRoutes from '../../src/routes/worldRoutes.js';
import { worldController } from '../../src/controllers/worldController.js';

describe('WorldRoutes', () => {
  it('debe exportar las rutas', () => {
    expect(worldRoutes).toBeDefined();
  });

  it('debe tener controlador definido', () => {
    expect(worldController).toBeDefined();
    expect(worldController.generateChunk).toBeDefined();
  });
});

