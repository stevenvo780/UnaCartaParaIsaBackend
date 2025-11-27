/**
 * Centralized constants for the simulation system.
 *
 * @deprecated This file has been consolidated into shared/constants/SimulationConstants.ts.
 * Please import from there instead. This file is kept for backward compatibility only.
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { SIM_CONSTANTS } from '../core/SimulationConstants';
 *
 * // New (preferred):
 * import { SIMULATION_CONSTANTS } from '../../../shared/constants/SimulationConstants';
 * const interval = SIMULATION_CONSTANTS.TIMING.TICK_INTERVAL_MS;
 * ```
 */

// Re-export from consolidated location
export {
  SIM_CONSTANTS,
  type SimConstantsType,
  SIMULATION_CONSTANTS,
  type SimulationConstantsType,
} from "../../../shared/constants/SimulationConstants";
