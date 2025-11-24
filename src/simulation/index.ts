import { SimulationRunner } from "./SimulationRunner.js";
import type { SimulationCommand } from "./types.js";

export const simulationRunner = new SimulationRunner();

// Initialize world with default config
// In a real app this might come from a config file or database
simulationRunner.initializeWorldResources({
  width: 128, // 128x128 tiles
  height: 128,
  tileSize: 32,
  biomeMap: [] // Will be generated
}).then(() => {
  console.log("World initialized, starting simulation loop...");
  simulationRunner.start();
}).catch(err => {
  console.error("Failed to initialize world:", err);
});

export type { SimulationCommand };
export type { SimulationSnapshot } from "./types.js";
