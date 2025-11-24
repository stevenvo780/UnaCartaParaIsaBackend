import { Router } from "express";
import { simulationRunner } from "@/domain/simulation/core/index";
import { storageService } from "@/infrastructure/services/storage/storageService";
import type { SimulationCommand } from "@/shared/types/commands/SimulationCommand";

const router = Router();

router.post("/api/sim/save", async (_req, res) => {
  try {
    const snapshot = simulationRunner.getSnapshot();
    const saveData = {
      ...snapshot.state,
      timestamp: Date.now(),
      gameTime: snapshot.state.togetherTime, // Assuming togetherTime is gameTime
      stats: {
        cycles: snapshot.state.cycles,
        resonance: snapshot.state.resonance
      }
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

router.post("/api/sim/command", (req, res): void => {
  const command = req.body as SimulationCommand;
  if (!command || typeof command.type !== "string") {
    res.status(400).json({ error: "Tipo de comando inválido" });
    return;
  }

  const accepted = simulationRunner.enqueueCommand(command);
  if (!accepted) {
    res.status(429).json({ error: "Cola de comandos llena" });
    return;
  }

  res.json({ status: "queued" });
});

export default router;
