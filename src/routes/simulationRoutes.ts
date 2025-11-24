import { Router } from "express";
import { simulationRunner } from "../simulation/index.js";
import { storageService } from "../services/storageService.js";
import type { SimulationCommand } from "../simulation/types.js";

const router = Router();

router.post("/api/sim/save", async (_req, res) => {
  try {
    const snapshot = simulationRunner.getSnapshot();
    const saveData = {
      ...snapshot.state,
      timestamp: Date.now(),
      gameTime: snapshot.state.togetherTime // Assuming togetherTime is gameTime
    };

    const result = await storageService.saveGame(saveData);
    res.json({ success: true, saveId: result.saveId });
  } catch (error) {
    console.error("Error saving simulation:", error);
    res.status(500).json({ error: "Failed to save simulation" });
  }
});

router.get("/api/sim/health", (_req, res) => {
  res.json({ status: "ok", tick: simulationRunner.getSnapshot().tick });
});

router.get("/api/sim/state", (_req, res) => {
  const snapshot = simulationRunner.getSnapshot();
  res.json(snapshot);
});

router.post("/api/sim/command", (req, res) => {
  const command = req.body as SimulationCommand;
  if (!command || typeof command.type !== "string") {
    return res.status(400).json({ error: "Tipo de comando inválido" });
  }

  const accepted = simulationRunner.enqueueCommand(command);
  if (!accepted) {
    return res.status(429).json({ error: "Cola de comandos llena" });
  }

  res.json({ status: "queued" });
});

export default router;
