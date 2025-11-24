import { Request, Response } from "express";
import { storageService } from "../services/storage/storageService.js";
import type { SaveData } from "../services/storage/storageService.js";
import { logger } from "../utils/logger.js";

const MAX_SAVE_ID_LENGTH = 200;
const SAVE_ID_PATTERN = /^save_\d+$/;

function sanitizeSaveId(id: string): string | null {
  // Remove path traversal attempts and limit length
  const sanitized = id
    .replace(/\.\./g, "")
    .replace(/\//g, "")
    .slice(0, MAX_SAVE_ID_LENGTH);
  // Validate format
  if (!SAVE_ID_PATTERN.test(sanitized)) {
    return null;
  }
  return sanitized;
}

function validateSaveData(data: unknown): data is SaveData {
  if (!data || typeof data !== "object") {
    return false;
  }
  const saveData = data as Record<string, unknown>;
  return (
    typeof saveData.timestamp === "number" &&
    saveData.timestamp > 0 &&
    typeof saveData.gameTime === "number"
  );
}

export class SaveController {
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const status = await storageService.isHealthy();
      res.json(status);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Health check failed:", errorMessage);
      res.status(503).json({ status: "error", message: "Storage unavailable" });
    }
  }

  async listSaves(_req: Request, res: Response): Promise<void> {
    try {
      const saves = await storageService.listSaves();
      res.json({ saves });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Error listing saves:", errorMessage);
      res.status(500).json({ error: "Failed to list saves" });
    }
  }

  async getSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "Save ID is required" });
        return;
      }

      const sanitizedId = sanitizeSaveId(id);
      if (!sanitizedId) {
        res.status(400).json({ error: "Invalid save ID format" });
        return;
      }

      const data = await storageService.getSave(sanitizedId);

      if (!data) {
        res.status(404).json({ error: "Save not found" });
        return;
      }

      res.json({ data });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error reading save:", errorMessage);
      res.status(500).json({ error: "Failed to read save" });
    }
  }

  async saveGame(req: Request, res: Response): Promise<void> {
    try {
      if (!validateSaveData(req.body)) {
        res.status(400).json({ error: "Invalid save data format" });
        return;
      }

      const saveData = req.body as SaveData;
      const result = await storageService.saveGame(saveData);

      res.json({
        success: true,
        saveId: result.saveId,
        size: result.size,
        timestamp: saveData.timestamp,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error saving game:", errorMessage);
      res.status(500).json({ error: "Failed to save game" });
    }
  }

  async deleteSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "Save ID is required" });
        return;
      }

      const sanitizedId = sanitizeSaveId(id);
      if (!sanitizedId) {
        res.status(400).json({ error: "Invalid save ID format" });
        return;
      }

      const success = await storageService.deleteSave(sanitizedId);

      if (!success) {
        res.status(404).json({ error: "Save not found" });
        return;
      }

      res.json({ success: true, message: "Save deleted" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting save:", errorMessage);
      res.status(500).json({ error: "Failed to delete save" });
    }
  }
}

export const saveController = new SaveController();
