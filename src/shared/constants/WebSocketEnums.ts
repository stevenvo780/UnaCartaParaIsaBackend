/**
 * WebSocket message type enumerations for the simulation system.
 *
 * Defines all message types used in WebSocket communication between
 * backend and frontend clients.
 *
 * @module shared/constants/WebSocketEnums
 */

/**
 * Enumeration of main WebSocket message types for simulation communication.
 */
export enum WebSocketMessageType {
  SNAPSHOT = "SNAPSHOT",
  ERROR = "ERROR",
  RESPONSE = "RESPONSE",
  TICK = "TICK",
}

/**
 * Type representing all possible WebSocket message type values.
 */

/**
 * Enumeration of chunk-related WebSocket message types.
 */
export enum ChunkMessageType {
  CHUNK_REQUEST = "CHUNK_REQUEST",
  CHUNK_CANCEL = "CHUNK_CANCEL",
  CHUNK_RESULT = "CHUNK_RESULT",
  CHUNK_ERROR = "CHUNK_ERROR",
  CHUNK_ACCEPTED = "CHUNK_ACCEPTED",
  CHUNK_STREAM_READY = "CHUNK_STREAM_READY",
  CHUNK_CANCELLED = "CHUNK_CANCELLED",
}

/**
 * Type representing all possible chunk message type values.
 */

/**
 * Enumeration of worker message types for background processing.
 */
export enum WorkerMessageType {
  GENERATE = "generate",
  RESULT = "result",
  READY = "ready",
  ERROR = "error",
  SNAPSHOT = "snapshot",
  SHUTDOWN = "shutdown",
}

/**
 * Type representing all possible worker message type values.
 */

/**
 * Array of all WebSocket message types for iteration.
 */

/**
 * Array of all chunk message types for iteration.
 */

/**
 * Array of all worker message types for iteration.
 */

/**
 * Type guard to check if a string is a valid WebSocketMessageType.
 */
// Alias/listas/guards eliminados para mantener sólo los enums consumidos.
