import { SimulationRunner } from "./SimulationRunner.js";
import type { SimulationCommand } from "./types.js";

export const simulationRunner = new SimulationRunner();
simulationRunner.start();

export type { SimulationCommand };
export type { SimulationSnapshot } from "./types.js";
