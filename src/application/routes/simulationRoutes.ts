import { Router, type Request, type Response } from "express";
import { simulationRunner } from "@/domain/simulation/core/index";
import { storageService } from "@/infrastructure/services/storage/storageService";
import type { SimulationCommand } from "@/shared/types/commands/SimulationCommand";
import { logger } from "@/infrastructure/utils/logger";
import { HttpStatusCode } from "@/shared/constants/HttpStatusCodes";
import { ResponseStatus } from "@/shared/constants/ResponseEnums";

const router = Router();

/**
 * Validates that the request body is a valid SimulationCommand.
 *
 * @param body - Unknown request body to validate
 * @returns True if body is a valid SimulationCommand with non-empty type
 */
function validateSimulationCommand(body: unknown): body is SimulationCommand {
  if (!body || typeof body !== "object") {
    return false;
  }
  const command = body as Record<string, unknown>;
  return typeof command.type === "string" && command.type.length > 0;
}

/**
 * Saves the current simulation state to persistent storage.
 *
 * Creates a save file with current game state, timestamp, and statistics.
 * The save can be loaded later to resume the simulation.
 *
 * @returns JSON response with success status and saveId
 *
 * @remarks
 * Side effects: Writes to storage (GCS or local filesystem).
 * Uses current simulation snapshot state.
 */
router.post(
  "/api/sim/save",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = simulationRunner.getInitialSnapshot();
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
      res
        .status(HttpStatusCode.INTERNAL_SERVER_ERROR)
        .json({ error: "Failed to save simulation" });
    }
  },
);

/**
 * Health check endpoint for simulation runner.
 *
 * Returns current simulation status and tick number.
 *
 * @returns JSON response with status OK and current tick number
 */
router.get("/api/sim/health", (_req: Request, res: Response): void => {
  try {
    const snapshot = simulationRunner.getInitialSnapshot();
    res.json({ status: ResponseStatus.OK, tick: snapshot.tick });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error getting simulation health:", errorMessage);
    res
      .status(HttpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to get simulation health" });
  }
});

/**
 * Retrieves the current full simulation state snapshot.
 *
 * Returns a complete snapshot of the game state including all entities,
 * resources, and simulation metadata.
 *
 * @returns JSON response with full SimulationSnapshot
 */
router.get("/api/sim/state", (_req: Request, res: Response): void => {
  try {
    const snapshot = simulationRunner.getInitialSnapshot();
    res.json(snapshot);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error getting simulation state:", errorMessage);
    res
      .status(HttpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to get simulation state" });
  }
});

/**
 * Enqueues a simulation command for execution.
 *
 * Validates command format and adds it to the simulation runner's command queue.
 * Returns 429 (Too Many Requests) if the command queue is full.
 *
 * @param req.body - SimulationCommand object with type and optional payload
 * @returns JSON response with status QUEUED on success, or error message
 *
 * @remarks
 * Side effects: Modifies simulation state through command queue.
 * Commands are processed asynchronously by SimulationRunner.
 */
router.post("/api/sim/command", (req: Request, res: Response): void => {
  try {
    if (!validateSimulationCommand(req.body)) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .json({ error: "Invalid command format" });
      return;
    }

    const command = req.body as SimulationCommand;
    const accepted = simulationRunner.enqueueCommand(command);
    if (!accepted) {
      res
        .status(HttpStatusCode.TOO_MANY_REQUESTS)
        .json({ error: "Command queue full" });
      return;
    }

    res.json({ status: ResponseStatus.QUEUED });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error processing command:", errorMessage);
    res
      .status(HttpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to process command" });
  }
});

export default router;
