import { BatchedEventEmitter } from "./BatchedEventEmitter";
import {
  GameEventType,
  ALL_GAME_EVENT_TYPES,
} from "../../../shared/constants/EventEnums";

/**
 * Global event emitter for simulation events.
 * Uses batched event processing to improve performance during ticks.
 *
 * @see BatchedEventEmitter for batching behavior
 */
export const simulationEvents = new BatchedEventEmitter();

/**
 * Game event type enum.
 * All simulation systems emit and listen to these events for coordination.
 */
export { GameEventType, ALL_GAME_EVENT_TYPES };
