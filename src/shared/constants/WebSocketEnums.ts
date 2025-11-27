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
export type WebSocketMessageTypeValue = `${WebSocketMessageType}`;

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
export type ChunkMessageTypeValue = `${ChunkMessageType}`;

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
export type WorkerMessageTypeValue = `${WorkerMessageType}`;

/**
 * Array of all WebSocket message types for iteration.
 */
export const ALL_WEBSOCKET_MESSAGE_TYPES: readonly WebSocketMessageType[] =
  Object.values(WebSocketMessageType) as WebSocketMessageType[];

/**
 * Array of all chunk message types for iteration.
 */
export const ALL_CHUNK_MESSAGE_TYPES: readonly ChunkMessageType[] =
  Object.values(ChunkMessageType) as ChunkMessageType[];

/**
 * Array of all worker message types for iteration.
 */
export const ALL_WORKER_MESSAGE_TYPES: readonly WorkerMessageType[] =
  Object.values(WorkerMessageType) as WorkerMessageType[];

/**
 * Type guard to check if a string is a valid WebSocketMessageType.
 */
export function isWebSocketMessageType(
  value: string,
): value is WebSocketMessageType {
  return Object.values(WebSocketMessageType).includes(
    value as WebSocketMessageType,
  );
}

/**
 * Type guard to check if a string is a valid ChunkMessageType.
 */
export function isChunkMessageType(value: string): value is ChunkMessageType {
  return Object.values(ChunkMessageType).includes(value as ChunkMessageType);
}

/**
 * Type guard to check if a string is a valid WorkerMessageType.
 */
export function isWorkerMessageType(value: string): value is WorkerMessageType {
  return Object.values(WorkerMessageType).includes(value as WorkerMessageType);
}
