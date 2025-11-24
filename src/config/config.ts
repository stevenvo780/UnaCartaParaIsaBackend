import path from 'path';

// Validate required environment variables for NAS if enabled
if (process.env.NAS_ENABLED === 'true') {
  const requiredNasVars = ['NAS_HOST', 'NAS_USER', 'NAS_PASSWORD', 'NAS_PATH'];
  const missingVars = requiredNasVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `NAS is enabled but missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please set these variables in your .env file or disable NAS by setting NAS_ENABLED=false'
    );
  }
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  BUCKET_NAME: process.env.BUCKET_NAME || 'una-carta-para-isa-saves',
  PROJECT_ID: process.env.GCP_PROJECT_ID || 'emergent-enterprises',
  USE_LOCAL_STORAGE: process.env.USE_LOCAL_STORAGE === 'true' || !process.env.GOOGLE_APPLICATION_CREDENTIALS,
  LOCAL_SAVES_PATH: process.env.LOCAL_SAVES_PATH || path.join(process.env.HOME || '.', '.local/share/una-carta-para-isa/saves'),
  NAS: {
    ENABLED: process.env.NAS_ENABLED === 'true',
    HOST: process.env.NAS_HOST || '',
    PORT: 22,
    USERNAME: process.env.NAS_USER || '',
    PASSWORD: process.env.NAS_PASSWORD || '',
    BACKUP_PATH: process.env.NAS_PATH || ''
  }
};
