
import "reflect-metadata";
import { container } from "./src/config/Container.ts";
import { TYPES } from "./src/config/Types.ts";
import { SimulationRunner } from "./src/domain/simulation/core/SimulationRunner.ts";
import { logger } from "./src/infrastructure/utils/logger.ts";
import { GPUComputeService } from "./src/domain/simulation/core/GPUComputeService.ts";

async function verifyAsyncGPU() {
  logger.info("🧪 Starting Async GPU Verification...");

  const runner = container.get<SimulationRunner>(TYPES.SimulationRunner);
  const gpuService = container.get<GPUComputeService>(TYPES.GPUComputeService);

  if (!gpuService.isGPUAvailable()) {
    logger.warn("⚠️ GPU not available, skipping GPU verification.");
    return;
  }

  logger.info("✅ GPU is available.");

  runner.start();

  logger.info("⏳ Running simulation for 5 seconds...");

  await new Promise((resolve) => setTimeout(resolve, 5000));

  runner.stop();

  logger.info("✅ Simulation stopped.");
  logger.info("✅ Verification complete. Check logs for any errors or warnings.");
}

verifyAsyncGPU().catch((err) => {
  logger.error("❌ Verification failed:", err);
  process.exit(1);
});
