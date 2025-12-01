/**
 * Enumeration of event channels used by the central event bus.
 * Channels organize events by their origin and destination.
 *
 * - `SCENE`: Phaser scene bus for game events
 * - `REACT`: Commands toward the React UI layer
 * - `SIMULATION`: Events emitted by workers or the backend
 * - `DEBUG`: Reserved channel for instrumentation and debugging
 */
export enum EventChannel {
  SCENE = "scene",
  REACT = "react",
  SIMULATION = "simulation",
  DEBUG = "debug",
}

/**
 * Type for event channel values (backward compatibility).
 */
export type EventChannelValue = EventChannel;
