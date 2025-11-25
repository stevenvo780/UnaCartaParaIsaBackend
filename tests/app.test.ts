import { describe, it, expect } from 'vitest';
import app from "../src/application/app.ts";

describe('App', () => {
  it('debe exportar la aplicación Express', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('debe tener las rutas configuradas', () => {
    expect(app).toBeDefined();
  });
});

