import { describe, it, expect } from 'vitest';
import worldRoutes from "../../src/application/routes/worldRoutes.ts";
import { worldController } from "../../src/infrastructure/controllers/worldController.ts";

describe('WorldRoutes', () => {
  it('debe exportar las rutas', () => {
    expect(worldRoutes).toBeDefined();
  });

  it('debe tener controlador definido', () => {
    expect(worldController).toBeDefined();
    expect(worldController.generateChunk).toBeDefined();
  });
});

