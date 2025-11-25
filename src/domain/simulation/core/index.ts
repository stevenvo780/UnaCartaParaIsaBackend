import { SimulationRunner } from "./SimulationRunner";
import type { SimulationCommand } from "../../../shared/types/commands/SimulationCommand";
import { logger } from "../../../infrastructure/utils/logger";
import { container } from "../../../config/container";
import { TYPES } from "../../../config/Types";

export const simulationRunner = container.get<SimulationRunner>(
  TYPES.SimulationRunner,
);

simulationRunner
  .initialize()
  .then(() => {
    return simulationRunner.initializeWorldResources({
      width: 128, // 128x128 tiles
      height: 128,
      tileSize: 32,
      biomeMap: [], // Will be generated internally
    });
  })
  .then(() => {
    logger.info("World initialized, starting simulation loop...");
    simulationRunner.start();
  })
  .catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to initialize simulation:", errorMessage);
  });

export type { SimulationCommand };
export type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";
