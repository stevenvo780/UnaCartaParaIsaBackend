import { BatchedEventEmitter } from "./BatchedEventEmitter";
import {
  GameEventNames,
  GameEventType,
} from "../../../shared/constants/EventEnums";

/**
 * Global event emitter for simulation events.
 * Uses batched event processing to improve performance during ticks.
 *
 * @see BatchedEventEmitter for batching behavior
 */
export const simulationEvents = new BatchedEventEmitter();

/**
 * Game event name constants.
 * All simulation systems emit and listen to these events for coordination.
 *
 * @deprecated Use GameEventType enum from EventEnums.ts instead
 * This is kept for backward compatibility during migration.
 */
export { GameEventNames, GameEventType };
