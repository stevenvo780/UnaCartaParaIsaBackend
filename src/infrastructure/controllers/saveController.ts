import { Request, Response } from "express";
import { storageService } from "../services/storage/storageService";
import type { SaveData } from "../services/storage/storageService";
import { logger } from "../utils/logger";
import { HttpStatusCode } from "../../shared/constants/HttpStatusCodes";
import { ResponseStatus } from "../../shared/constants/ResponseEnums";

/**
 * Save operation constants.
 * Centralized to ensure consistency and prevent magic numbers.
 */
const SAVE_CONSTANTS = {
  MAX_SAVE_ID_LENGTH: 200,
  SAVE_ID_PATTERN: /^save_\d+$/,
} as const;

/**
 * Sanitizes and validates a save ID.
 * Removes path traversal attempts and enforces format: save_<timestamp>
 */
function sanitizeSaveId(id: string): string | null {
  const sanitized = id
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .slice(0, SAVE_CONSTANTS.MAX_SAVE_ID_LENGTH);
  if (!SAVE_CONSTANTS.SAVE_ID_PATTERN.test(sanitized)) {
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

/**
 * Controller for save/load game state operations.
 *
 * Handles HTTP endpoints for:
 * - Health checks
 * - Listing saves
 * - Retrieving saves
 * - Saving game state
 * - Deleting saves
 *
 * All save IDs are sanitized to prevent path traversal attacks.
 */
export class SaveController {
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const status = await storageService.isHealthy();
      res.json(status);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Health check failed:", errorMessage);
      res.status(HttpStatusCode.SERVICE_UNAVAILABLE).json({
        status: ResponseStatus.ERROR,
        message: "Storage unavailable",
      });
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
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: "Failed to list saves",
      });
    }
  }

  async getSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Save ID is required",
        });
        return;
      }

      const sanitizedId = sanitizeSaveId(id);
      if (!sanitizedId) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Invalid save ID format",
        });
        return;
      }

      const data = await storageService.getSave(sanitizedId);

      if (!data) {
        res.status(HttpStatusCode.NOT_FOUND).json({ error: "Save not found" });
        return;
      }

      res.json({ data });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Error reading save:", errorMessage);
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: "Failed to read save",
      });
    }
  }

  async saveGame(req: Request, res: Response): Promise<void> {
    try {
      if (!validateSaveData(req.body)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Invalid save data format",
        });
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
      logger.error("Error saving game:", errorMessage);
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: "Failed to save game",
      });
    }
  }

  async deleteSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Save ID is required",
        });
        return;
      }

      const sanitizedId = sanitizeSaveId(id);
      if (!sanitizedId) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: "Invalid save ID format",
        });
        return;
      }

      const success = await storageService.deleteSave(sanitizedId);

      if (!success) {
        res.status(HttpStatusCode.NOT_FOUND).json({ error: "Save not found" });
        return;
      }

      res.json({ success: true, message: "Save deleted" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Error deleting save:", errorMessage);
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: "Failed to delete save",
      });
    }
  }
}

export const saveController = new SaveController();
