import path from 'path';

export const CONFIG = {
  PORT: process.env.PORT || 8080,
  BUCKET_NAME: process.env.BUCKET_NAME || 'una-carta-para-isa-saves',
  PROJECT_ID: process.env.GCP_PROJECT_ID || 'emergent-enterprises',
  USE_LOCAL_STORAGE: process.env.USE_LOCAL_STORAGE === 'true' || !process.env.GOOGLE_APPLICATION_CREDENTIALS,
  LOCAL_SAVES_PATH: process.env.LOCAL_SAVES_PATH || path.join(process.env.HOME || '.', '.local/share/una-carta-para-isa/saves'),
  NAS: {
    ENABLED: process.env.NAS_ENABLED === 'true',
    HOST: process.env.NAS_HOST || '192.168.1.12',
    PORT: 22,
    USERNAME: process.env.NAS_USER || 'nass',
    PASSWORD: process.env.NAS_PASSWORD || 'MiutHuheCAp9',
    BACKUP_PATH: process.env.NAS_PATH || '/mnt/raid10/backups/una-carta-para-isa'
  }
};
