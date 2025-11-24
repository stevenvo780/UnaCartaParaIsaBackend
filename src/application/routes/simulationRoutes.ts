import { Router, type Request, type Response } from "express";
import { simulationRunner } from "@/domain/simulation/core/index";
import { storageService } from "@/infrastructure/services/storage/storageService";
import type { SimulationCommand } from "@/shared/types/commands/SimulationCommand";

const router = Router();

function validateSimulationCommand(body: unknown): body is SimulationCommand {
  if (!body || typeof body !== "object") {
    return false;
  }
  const command = body as Record<string, unknown>;
  return typeof command.type === "string" && command.type.length > 0;
}

router.post(
  "/api/sim/save",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = simulationRunner.getSnapshot();
      const saveData = {
        ...snapshot.state,
        timestamp: Date.now(),
        gameTime: snapshot.state.togetherTime,
        stats: {
          cycles: snapshot.state.cycles,
          resonance: snapshot.state.resonance ?? 0,
        },
      };

      const result = await storageService.saveGame(saveData);
      res.json({ success: true, saveId: result.saveId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Error saving simulation:", errorMessage);
      res.status(500).json({ error: "Failed to save simulation" });
    }
  },
);

router.get("/api/sim/health", (_req: Request, res: Response): void => {
  try {
    const snapshot = simulationRunner.getSnapshot();
    res.json({ status: "ok", tick: snapshot.tick });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error getting simulation health:", errorMessage);
    res.status(500).json({ error: "Failed to get simulation health" });
  }
});

router.get("/api/sim/state", (_req: Request, res: Response): void => {
  try {
    const snapshot = simulationRunner.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error getting simulation state:", errorMessage);
    res.status(500).json({ error: "Failed to get simulation state" });
  }
});

router.post("/api/sim/command", (req: Request, res: Response): void => {
  try {
    if (!validateSimulationCommand(req.body)) {
      res.status(400).json({ error: "Invalid command format" });
      return;
    }

    const command = req.body as SimulationCommand;
    const accepted = simulationRunner.enqueueCommand(command);
    if (!accepted) {
      res.status(429).json({ error: "Command queue full" });
      return;
    }

    res.json({ status: "queued" });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error processing command:", errorMessage);
    res.status(500).json({ error: "Failed to process command" });
  }
});

export default router;
