import path from "path";

/**
 * Application configuration loaded from environment variables.
 *
 * Supports multiple storage backends:
 * - Google Cloud Storage (GCS) - primary cloud storage
 * - Local filesystem - fallback when GCS credentials unavailable
 * - NAS (Network Attached Storage) - optional backup via SFTP
 *
 * @module config
 */

if (process.env.NAS_ENABLED === "true") {
  const requiredNasVars = ["NAS_HOST", "NAS_USER", "NAS_PASSWORD", "NAS_PATH"];
  const missingVars = requiredNasVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `NAS is enabled but missing required environment variables: ${missingVars.join(", ")}\n` +
        "Please set these variables in your .env file or disable NAS by setting NAS_ENABLED=false",
    );
  }
}

/**
 * Application configuration object.
 *
 * @property {number} PORT - HTTP server port (default: 8080)
 * @property {string} BUCKET_NAME - GCS bucket name for saves
 * @property {string} PROJECT_ID - Google Cloud project ID
 * @property {boolean} USE_LOCAL_STORAGE - Whether to use local filesystem instead of GCS
 * @property {string} LOCAL_SAVES_PATH - Local directory path for save files
 * @property {Object} NAS - Network Attached Storage configuration for backups
 * @property {boolean} NAS.ENABLED - Whether NAS backups are enabled
 * @property {string} NAS.HOST - NAS server hostname
 * @property {number} NAS.PORT - NAS SFTP port (default: 22)
 * @property {string} NAS.USERNAME - NAS SFTP username
 * @property {string} NAS.PASSWORD - NAS SFTP password
 * @property {string} NAS.BACKUP_PATH - Remote directory path on NAS
 */
export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  BUCKET_NAME: process.env.BUCKET_NAME || "una-carta-para-isa-saves",
  PROJECT_ID: process.env.GCP_PROJECT_ID || "emergent-enterprises",
  USE_LOCAL_STORAGE:
    process.env.USE_LOCAL_STORAGE === "true" ||
    !process.env.GOOGLE_APPLICATION_CREDENTIALS,
  LOCAL_SAVES_PATH:
    process.env.LOCAL_SAVES_PATH ||
    path.join(process.env.HOME || ".", ".local/share/una-carta-para-isa/saves"),
  NAS: {
    ENABLED: process.env.NAS_ENABLED === "true",
    HOST: process.env.NAS_HOST || "",
    PORT: 22,
    USERNAME: process.env.NAS_USER || "",
    PASSWORD: process.env.NAS_PASSWORD || "",
    BACKUP_PATH: process.env.NAS_PATH || "",
  },
};
