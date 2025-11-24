import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONFIG } from '../../src/config/config.js';

describe('Config', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.PORT;
    delete process.env.BUCKET_NAME;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.USE_LOCAL_STORAGE;
    delete process.env.LOCAL_SAVES_PATH;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.NAS_ENABLED;
    delete process.env.NAS_HOST;
    delete process.env.NAS_USER;
    delete process.env.NAS_PASSWORD;
    delete process.env.NAS_PATH;
  });

  it('debe tener valores por defecto', () => {
    expect(CONFIG.PORT).toBeDefined();
    expect(CONFIG.BUCKET_NAME).toBeDefined();
    expect(CONFIG.PROJECT_ID).toBeDefined();
    expect(CONFIG.USE_LOCAL_STORAGE).toBeDefined();
    expect(CONFIG.LOCAL_SAVES_PATH).toBeDefined();
    expect(CONFIG.NAS).toBeDefined();
  });

  it('debe tener valores por defecto para configuración', () => {
    expect(CONFIG.PORT).toBeDefined();
    expect(CONFIG.BUCKET_NAME).toBeDefined();
    expect(CONFIG.PROJECT_ID).toBeDefined();
  });

  it('debe tener configuración NAS', () => {
    expect(CONFIG.NAS).toBeDefined();
    expect(CONFIG.NAS.ENABLED).toBeDefined();
    expect(CONFIG.NAS.HOST).toBeDefined();
    expect(CONFIG.NAS.PORT).toBeDefined();
  });
});

