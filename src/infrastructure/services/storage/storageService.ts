import { Storage, Bucket } from "@google-cloud/storage";
import SftpClient from "ssh2-sftp-client";
import fs from "fs/promises";
import path from "path";
import { CONFIG } from "../../../config/config.js";
import { logger } from "@/infrastructure/utils/logger";
import {
  StorageStatus,
  StorageType,
  StorageFilePrefix,
} from "../../../shared/constants/StatusEnums";

/**
 * Game statistics for save metadata.
 */
export interface GameStats {
  population?: number;
  resources?: Record<string, number>;
  cycles?: number;
  time?: number;
  dayTime?: number;
  togetherTime?: number;
  resonance?: number;
  [key: string]: string | number | Record<string, number> | undefined;
}

/**
 * Metadata for a saved game file.
 */
export interface SaveMetadata {
  id: string;
  timestamp: number;
  gameTime: number;
  stats: GameStats;
  size: number;
  modified: string;
}

/**
 * Complete save data structure.
 *
 * @property state - GameState (typed as unknown to avoid circular dependency)
 */
export interface SaveData {
  timestamp: number;
  gameTime: number;
  stats: GameStats;
  state?: unknown;
  [key: string]: string | number | GameStats | unknown | undefined;
}

/**
 * Service for saving and loading game state.
 *
 * Supports both Google Cloud Storage (GCS) and local filesystem storage.
 * Automatically falls back to local storage if GCS is unavailable.
 *
 * @see CONFIG for storage configuration
 */
export class StorageService {
  private bucket: Bucket | null = null;
  private useGCS: boolean = false;

  constructor() {
    if (!CONFIG.USE_LOCAL_STORAGE) {
      try {
        const storage = new Storage({
          projectId: CONFIG.PROJECT_ID,
        });
        this.bucket = storage.bucket(CONFIG.BUCKET_NAME);
        this.useGCS = true;
      } catch (error) {
        logger.warn("GCS not available, using local storage", {
          error: error instanceof Error ? error.message : String(error),
          projectId: CONFIG.PROJECT_ID,
          bucketName: CONFIG.BUCKET_NAME,
        });
      }
    }
  }

  /**
   * Checks storage service health.
   *
   * @returns Health status with storage type (gcs or local)
   *
   * @remarks
   * Side effects: May perform network I/O for GCS or filesystem I/O for local storage.
   * Used by health check endpoints.
   */
  async isHealthy(): Promise<{
    status: StorageStatus;
    timestamp: number;
    storage: StorageType;
  }> {
    if (this.useGCS && this.bucket) {
      await this.bucket.exists();
      return {
        status: StorageStatus.OK,
        timestamp: Date.now(),
        storage: StorageType.GCS,
      };
    } else {
      await this.ensureLocalDir();
      return {
        status: StorageStatus.OK,
        timestamp: Date.now(),
        storage: StorageType.LOCAL,
      };
    }
  }

  /**
   * Lists all available save files with metadata.
   *
   * Saves are sorted by timestamp (newest first). Supports both GCS and local storage.
   *
   * @returns Array of save metadata sorted by timestamp (newest first)
   *
   * @remarks
   * Side effects: May perform I/O operations to list files from storage.
   * For GCS, this queries the bucket. For local storage, this reads the directory.
   */
  async listSaves(): Promise<SaveMetadata[]> {
    let saves: SaveMetadata[] = [];

    if (this.useGCS && this.bucket) {
      const [files] = await this.bucket.getFiles({ prefix: StorageFilePrefix.SAVE });
      const gcsEntries = await Promise.all(
        files
          .filter((f) => f.name.endsWith(".json"))
          .map(async (file) => {
            const [metadata] = await file.getMetadata();
            const [content] = await file.download();
            const parsed = this.safelyParseSaveData(content.toString());
            if (!parsed) {
              logger.warn("Skipping invalid save from GCS", {
                file: file.name,
              });
              return null;
            }

            return {
              id: file.name.replace(".json", ""),
              timestamp: parsed.timestamp,
              gameTime: parsed.gameTime,
              stats: parsed.stats,
              size: Number.parseInt(String(metadata.size ?? "0"), 10),
              modified: metadata.updated ?? new Date().toISOString(),
            } satisfies SaveMetadata;
          }),
      );

      saves = gcsEntries.reduce<SaveMetadata[]>((acc, entry) => {
        if (entry) acc.push(entry);
        return acc;
      }, []);
    } else {
      await this.ensureLocalDir();
      const files = await fs.readdir(CONFIG.LOCAL_SAVES_PATH);
      const localEntries = await Promise.all(
        files
          .filter((f) => f.endsWith(".json") && f.startsWith(StorageFilePrefix.SAVE))
          .map(async (filename) => {
            const filepath = path.join(CONFIG.LOCAL_SAVES_PATH, filename);
            const content = await fs.readFile(filepath, "utf-8");
            const stat = await fs.stat(filepath);
            const parsed = this.safelyParseSaveData(content);
            if (!parsed) {
              logger.warn("Skipping invalid local save", { filename });
              return null;
            }

            return {
              id: filename.replace(".json", ""),
              timestamp: parsed.timestamp,
              gameTime: parsed.gameTime,
              stats: parsed.stats,
              size: stat.size,
              modified: stat.mtime.toISOString(),
            } satisfies SaveMetadata;
          }),
      );

      saves = localEntries.reduce<SaveMetadata[]>((acc, entry) => {
        if (entry) acc.push(entry);
        return acc;
      }, []);
    }

    return saves.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Retrieves a saved game by ID.
   *
   * @param id - Save file ID (format: save_<timestamp>)
   * @returns Save data if found, null otherwise
   *
   * @remarks
   * Side effects: Performs I/O to read from GCS bucket or local filesystem.
   * Returns null if save doesn't exist or is corrupted.
   */
  async getSave(id: string): Promise<SaveData | null> {
    if (this.useGCS && this.bucket) {
      const file = this.bucket.file(`${id}.json`);
      const [exists] = await file.exists();
      if (!exists) return null;

      const [content] = await file.download();
      const parsed = this.safelyParseSaveData(content.toString());
      if (!parsed) {
        logger.warn("Invalid save data received from GCS", { id });
        return null;
      }
      return parsed;
    } else {
      const filepath = path.join(CONFIG.LOCAL_SAVES_PATH, `${id}.json`);
      try {
        const content = await fs.readFile(filepath, "utf-8");
        const parsed = this.safelyParseSaveData(content);
        if (!parsed) {
          logger.warn("Invalid save data read from local storage", { id });
          return null;
        }
        return parsed;
      } catch (error) {
        logger.warn("Error reading save file from local storage", {
          id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }
  }

  /**
   * Saves game state to storage.
   *
   * Saves to GCS or local filesystem based on configuration.
   * Automatically triggers NAS backup if enabled (async, non-blocking).
   * Triggers cleanup of old saves (keeps 10 most recent, async, non-blocking).
   *
   * @param {SaveData} saveData - Complete game state to save
   * @returns {Promise<Object>} Save operation result
   * @returns {string} returns.saveId - Generated save ID (save_<timestamp>)
   * @returns {number} returns.size - Size of saved file in bytes
   */
  async saveGame(
    saveData: SaveData,
  ): Promise<{ saveId: string; size: number }> {
    const saveId = `${StorageFilePrefix.SAVE}${saveData.timestamp}`;
    const content = JSON.stringify(saveData, null, 2);
    let size = 0;

    if (this.useGCS && this.bucket) {
      const file = this.bucket.file(`${saveId}.json`);
      await file.save(content, {
        contentType: "application/json",
        metadata: { cacheControl: "no-cache" },
      });
      const [metadata] = await file.getMetadata();
      size = parseInt(String(metadata.size || "0"));
    } else {
      await this.ensureLocalDir();
      const filepath = path.join(CONFIG.LOCAL_SAVES_PATH, `${saveId}.json`);
      await fs.writeFile(filepath, content, "utf-8");
      const stat = await fs.stat(filepath);
      size = stat.size;
    }

    if (CONFIG.NAS.ENABLED) {
      this.backupToNAS(saveId, content).catch((err) =>
        logger.error("NAS backup error:", err),
      );
    }

    this.cleanOldSaves().catch((err) => logger.error("Cleanup error:", err));

    return { saveId, size };
  }

  /**
   * Deletes a saved game by ID.
   *
   * @param id - Save file ID (format: save_<timestamp>)
   * @returns True if save was deleted, false if it didn't exist
   *
   * @remarks
   * Side effects: Performs I/O to delete from GCS bucket or local filesystem.
   * This operation is irreversible.
   */
  async deleteSave(id: string): Promise<boolean> {
    if (this.useGCS && this.bucket) {
      const file = this.bucket.file(`${id}.json`);
      const [exists] = await file.exists();
      if (!exists) return false;
      await file.delete();
      return true;
    } else {
      const filepath = path.join(CONFIG.LOCAL_SAVES_PATH, `${id}.json`);
      try {
        await fs.unlink(filepath);
        return true;
      } catch (error) {
        logger.warn("Error deleting save file from local storage", {
          id,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }
  }

  private isSaveData(value: unknown): value is SaveData {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.timestamp === "number" &&
      typeof candidate.gameTime === "number" &&
      typeof candidate.stats === "object" &&
      candidate.stats !== null
    );
  }

  private safelyParseSaveData(rawContent: string): SaveData | null {
    try {
      const parsed: unknown = JSON.parse(rawContent);
      return this.isSaveData(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async ensureLocalDir(): Promise<void> {
    try {
      await fs.mkdir(CONFIG.LOCAL_SAVES_PATH, { recursive: true });
    } catch (error) {
      logger.debug(
        `Failed to create local saves directory ${CONFIG.LOCAL_SAVES_PATH}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Backs up save file to Network Attached Storage via SFTP.
   *
   * Creates remote directory if it doesn't exist.
   * Non-blocking operation - errors are logged but don't fail the save.
   *
   * @param {string} saveId - Save file ID
   * @param {string} content - JSON content to backup
   * @returns {Promise<boolean>} True if backup succeeded
   */
  private async backupToNAS(saveId: string, content: string): Promise<boolean> {
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: CONFIG.NAS.HOST,
        port: CONFIG.NAS.PORT,
        username: CONFIG.NAS.USERNAME,
        password: CONFIG.NAS.PASSWORD,
      });

      const dirExists = await sftp.exists(CONFIG.NAS.BACKUP_PATH);
      if (!dirExists) {
        await sftp.mkdir(CONFIG.NAS.BACKUP_PATH, true);
      }

      const remotePath = `${CONFIG.NAS.BACKUP_PATH}/${saveId}.json`;
      await sftp.put(Buffer.from(content), remotePath);

      logger.info(`📦 Backup to NAS: ${remotePath}`);
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("NAS backup failed:", errorMessage);
      return false;
    } finally {
      await sftp.end();
    }
  }

  /**
   * Cleans up old save files, keeping only the 10 most recent.
   *
   * Works with both GCS and local storage.
   * Non-blocking operation - errors are logged but don't affect saves.
   */
  private async cleanOldSaves(): Promise<void> {
    try {
      if (this.useGCS && this.bucket) {
        const [gcsFiles] = await this.bucket.getFiles({ prefix: StorageFilePrefix.SAVE });
        if (gcsFiles.length <= 10) return;

        const filesWithMeta = await Promise.all(
          gcsFiles.map(async (file) => {
            const [metadata] = await file.getMetadata();
            return {
              file,
              updated: new Date(metadata.updated || 0).getTime(),
            };
          }),
        );

        filesWithMeta.sort((a, b) => b.updated - a.updated);
        const toDelete = filesWithMeta.slice(10);
        await Promise.all(toDelete.map(({ file }) => file.delete()));
        logger.info(`Cleaned ${toDelete.length} old saves from GCS`);
      } else {
        await this.ensureLocalDir();
        const localFiles = await fs.readdir(CONFIG.LOCAL_SAVES_PATH);
        const saveFiles = localFiles.filter(
          (f) => f.endsWith(".json") && f.startsWith(StorageFilePrefix.SAVE),
        );

        if (saveFiles.length <= 10) return;

        const filesWithMeta = await Promise.all(
          saveFiles.map(async (filename) => {
            const filepath = path.join(CONFIG.LOCAL_SAVES_PATH, filename);
            const stat = await fs.stat(filepath);
            return {
              filename,
              filepath,
              updated: stat.mtime.getTime(),
            };
          }),
        );

        filesWithMeta.sort((a, b) => b.updated - a.updated);
        const toDelete = filesWithMeta.slice(10);
        await Promise.all(toDelete.map(({ filepath }) => fs.unlink(filepath)));
        logger.info(`Cleaned ${toDelete.length} old saves from local storage`);
      }
    } catch (error) {
      logger.error("Error cleaning old saves:", error);
    }
  }
}

export const storageService = new StorageService();
