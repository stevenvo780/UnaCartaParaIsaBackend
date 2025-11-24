import { Storage, Bucket } from "@google-cloud/storage";
import SftpClient from "ssh2-sftp-client";
import fs from "fs/promises";
import path from "path";
import { CONFIG } from "../../../config/config.js";
import { logger } from "@/infrastructure/utils/logger";

export interface GameStats {
  population?: number;
  resources?: Record<string, number>;
  cycles?: number;
  [key: string]: unknown;
}

export interface SaveMetadata {
  id: string;
  timestamp: number;
  gameTime: number;
  stats: GameStats;
  size: number;
  modified: string;
}

export interface SaveData {
  timestamp: number;
  gameTime: number;
  stats: GameStats;
  [key: string]: unknown;
}

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
      } catch (_error) {
        logger.warn("GCS not available, using local storage");
      }
    }
  }

  async isHealthy(): Promise<{
    status: string;
    timestamp: number;
    storage: string;
  }> {
    if (this.useGCS && this.bucket) {
      await this.bucket.exists();
      return { status: "ok", timestamp: Date.now(), storage: "gcs" };
    } else {
      await this.ensureLocalDir();
      return { status: "ok", timestamp: Date.now(), storage: "local" };
    }
  }

  async listSaves(): Promise<SaveMetadata[]> {
    let saves: SaveMetadata[] = [];

    if (this.useGCS && this.bucket) {
      const [files] = await this.bucket.getFiles({ prefix: "save_" });
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
          .filter((f) => f.endsWith(".json") && f.startsWith("save_"))
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
      } catch (_error) {
        return null;
      }
    }
  }

  async saveGame(
    saveData: SaveData,
  ): Promise<{ saveId: string; size: number }> {
    const saveId = `save_${saveData.timestamp}`;
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
      } catch (_error) {
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
    } catch (_error) {
      // Directory already exists or creation failed
    }
  }

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

  private async cleanOldSaves(): Promise<void> {
    try {
      if (this.useGCS && this.bucket) {
        const [gcsFiles] = await this.bucket.getFiles({ prefix: "save_" });
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
          (f) => f.endsWith(".json") && f.startsWith("save_"),
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
