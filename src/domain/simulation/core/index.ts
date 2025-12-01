import { SimulationRunner } from "./SimulationRunner";
import { container } from "../../../config/container";
import { TYPES } from "../../../config/Types";

export const simulationRunner = container.get<SimulationRunner>(
  TYPES.SimulationRunner,
);

export type { SimulationCommand } from "../../../shared/types/commands/SimulationCommand";
export type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";

export { EventBus } from "./EventBus";
export type {
  SystemEvents,
  EventName,
  EventData,
  EventHandler,
  EventBusConfig,
} from "./EventBus";
