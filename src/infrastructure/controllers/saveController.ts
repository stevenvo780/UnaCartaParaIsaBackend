import { Request, Response } from "express";
import { storageService } from "../services/storage/storageService.js";
import type { SaveData } from "../services/storage/storageService.js";
import { logger } from "../utils/logger.js";

const MAX_SAVE_ID_LENGTH = 200;
const SAVE_ID_PATTERN = /^save_\d+$/;

/**
 * Sanitizes and validates a save ID.
 *
 * Removes path traversal attempts and enforces format: save_<timestamp>
 *
 * @param {string} id - Raw save ID to sanitize
 * @returns {string | null} Sanitized ID or null if invalid format
 */
function sanitizeSaveId(id: string): string | null {
  const sanitized = id
    .replace(/\.\./g, "")
    .replace(/\//g, "")
    .slice(0, MAX_SAVE_ID_LENGTH);
  if (!SAVE_ID_PATTERN.test(sanitized)) {
    return null;
  }
  return sanitized;
}

/**
 * Type guard to validate save data structure.
 *
 * @param {unknown} data - Data to validate
 * @returns {boolean} True if data matches SaveData interface
 */
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
  /**
   * Health check endpoint.
   *
   * Verifies storage service availability.
   *
   * @param {Request} _req - Express request (unused)
   * @param {Response} res - Express response
   */
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

  /**
   * Lists all available save files.
   *
   * @param {Request} _req - Express request (unused)
   * @param {Response} res - Express response with saves array
   */
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

  /**
   * Retrieves a specific save file by ID.
   *
   * @param {Request} req - Express request with save ID in params
   * @param {Response} res - Express response with save data or error
   */
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
      logger.error("Error reading save:", errorMessage);
      res.status(500).json({ error: "Failed to read save" });
    }
  }

  /**
   * Saves game state.
   *
   * Validates save data structure before saving.
   *
   * @param {Request} req - Express request with SaveData in body
   * @param {Response} res - Express response with save result
   */
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
      logger.error("Error saving game:", errorMessage);
      res.status(500).json({ error: "Failed to save game" });
    }
  }

  /**
   * Deletes a save file by ID.
   *
   * @param {Request} req - Express request with save ID in params
   * @param {Response} res - Express response with deletion result
   */
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
      logger.error("Error deleting save:", errorMessage);
      res.status(500).json({ error: "Failed to delete save" });
    }
  }
}

export const saveController = new SaveController();
