import { Request, Response } from "express";
import { storageService } from "../services/storage/storageService.js";

export class SaveController {
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const status = await storageService.isHealthy();
      res.json(status);
    } catch (_error) {
      res.status(503).json({ status: "error", message: "Storage unavailable" });
    }
  }

  async listSaves(_req: Request, res: Response): Promise<void> {
    try {
      const saves = await storageService.listSaves();
      res.json({ saves });
    } catch (error) {
      console.error("Error listing saves:", error);
      res.status(500).json({ error: "Failed to list saves" });
    }
  }

  async getSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await storageService.getSave(id);

      if (!data) {
        res.status(404).json({ error: "Save not found" });
        return;
      }

      res.json({ data });
    } catch (error) {
      console.error("Error reading save:", error);
      res.status(500).json({ error: "Failed to read save" });
    }
  }

  async saveGame(req: Request, res: Response): Promise<void> {
    try {
      const saveData = req.body;

      if (!saveData || !saveData.timestamp) {
        res.status(400).json({ error: "Invalid save data" });
        return;
      }

      const result = await storageService.saveGame(saveData);

      res.json({
        success: true,
        saveId: result.saveId,
        size: result.size,
        timestamp: saveData.timestamp,
      });
    } catch (error) {
      console.error("Error saving game:", error);
      res.status(500).json({ error: "Failed to save game" });
    }
  }

  async deleteSave(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await storageService.deleteSave(id);

      if (!success) {
        res.status(404).json({ error: "Save not found" });
        return;
      }

      res.json({ success: true, message: "Save deleted" });
    } catch (error) {
      console.error("Error deleting save:", error);
      res.status(500).json({ error: "Failed to delete save" });
    }
  }
}

export const saveController = new SaveController();
