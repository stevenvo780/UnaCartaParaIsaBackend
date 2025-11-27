/**
 * Centralized constants for the simulation system.
 *
 * @deprecated This file has been consolidated into shared/constants/SimulationConstants.ts.
 * Please import from there instead. This file is kept for backward compatibility only.
 *
 * @example
 * ```typescript
 *
 * import { SIM_CONSTANTS } from '../core/SimulationConstants';
 *
 *
 * import { SIMULATION_CONSTANTS } from '../../../shared/constants/SimulationConstants';
 * const interval = SIMULATION_CONSTANTS.TIMING.TICK_INTERVAL_MS;
 * ```
 */

export {
  SIM_CONSTANTS,
  type SimConstantsType,
  SIMULATION_CONSTANTS,
  type SimulationConstantsType,
} from "../../../shared/constants/SimulationConstants";
