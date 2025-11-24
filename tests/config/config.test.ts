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

  it('debe usar valores de entorno cuando están disponibles', () => {
    process.env.PORT = '3000';
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.GCP_PROJECT_ID = 'test-project';
    
    // Re-import para que tome los nuevos valores
    vi.resetModules();
    const { CONFIG: newConfig } = require('../../src/config/config.js');
    
    expect(newConfig.PORT).toBe(3000);
    expect(newConfig.BUCKET_NAME).toBe('test-bucket');
    expect(newConfig.PROJECT_ID).toBe('test-project');
  });

  it('debe configurar NAS cuando está habilitado', () => {
    process.env.NAS_ENABLED = 'true';
    process.env.NAS_HOST = '192.168.1.100';
    process.env.NAS_USER = 'testuser';
    process.env.NAS_PASSWORD = 'testpass';
    process.env.NAS_PATH = '/test/path';
    
    vi.resetModules();
    const { CONFIG: newConfig } = require('../../src/config/config.js');
    
    expect(newConfig.NAS.ENABLED).toBe(true);
    expect(newConfig.NAS.HOST).toBe('192.168.1.100');
    expect(newConfig.NAS.USERNAME).toBe('testuser');
    expect(newConfig.NAS.PASSWORD).toBe('testpass');
    expect(newConfig.NAS.BACKUP_PATH).toBe('/test/path');
  });

  it('debe usar almacenamiento local cuando no hay credenciales de GCP', () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    vi.resetModules();
    const { CONFIG: newConfig } = require('../../src/config/config.js');
    
    expect(newConfig.USE_LOCAL_STORAGE).toBe(true);
  });
});

