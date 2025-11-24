import { Request, Response } from 'express';
import { storageService } from '../services/storageService.js';

export class SaveController {
  async healthCheck(req: Request, res: Response) {
    try {
      const status = await storageService.isHealthy();
      res.json(status);
    } catch (error) {
      res.status(503).json({ status: 'error', message: 'Storage unavailable' });
    }
  }

  async listSaves(req: Request, res: Response) {
    try {
      const saves = await storageService.listSaves();
      res.json({ saves });
    } catch (error) {
      console.error('Error listing saves:', error);
      res.status(500).json({ error: 'Failed to list saves' });
    }
  }

  async getSave(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = await storageService.getSave(id);
      
      if (!data) {
        return res.status(404).json({ error: 'Save not found' });
      }

      res.json({ data });
    } catch (error) {
      console.error('Error reading save:', error);
      res.status(500).json({ error: 'Failed to read save' });
    }
  }

  async saveGame(req: Request, res: Response) {
    try {
      const saveData = req.body;

      if (!saveData || !saveData.timestamp) {
        return res.status(400).json({ error: 'Invalid save data' });
      }

      const result = await storageService.saveGame(saveData);

      res.json({
        success: true,
        saveId: result.saveId,
        size: result.size,
        timestamp: saveData.timestamp,
      });
    } catch (error) {
      console.error('Error saving game:', error);
      res.status(500).json({ error: 'Failed to save game' });
    }
  }

  async deleteSave(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await storageService.deleteSave(id);

      if (!success) {
        return res.status(404).json({ error: 'Save not found' });
      }

      res.json({ success: true, message: 'Save deleted' });
    } catch (error) {
      console.error('Error deleting save:', error);
      res.status(500).json({ error: 'Failed to delete save' });
    }
  }
}

export const saveController = new SaveController();
