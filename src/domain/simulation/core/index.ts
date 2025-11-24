import { SimulationRunner } from "./SimulationRunner";
import type { SimulationCommand } from "../../../shared/types/commands/SimulationCommand";
import { logger } from "../../../infrastructure/utils/logger";

export const simulationRunner = new SimulationRunner();

simulationRunner
  .initializeWorldResources({
    width: 128, // 128x128 tiles
    height: 128,
    tileSize: 32,
    biomeMap: [], // Will be generated
  })
  .then(() => {
    logger.info("World initialized, starting simulation loop...");
    simulationRunner.start();
  })
  .catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to initialize world:", errorMessage);
  });

export type { SimulationCommand };
export type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";
