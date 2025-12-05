/**
 * MessagePack codec for WebSocket communication.
 *
 * Provides efficient binary serialization/deserialization.
 * ~30-50% more compact than JSON, especially for numeric data (positions, stats).
 *
 * Compatible with JSON as fallback for debugging.
 */

import { encode, decode } from "@msgpack/msgpack";

/**
 * Detects if a message is MessagePack (binary) or JSON (text).
 *
 * @param data - Message data to check
 * @returns True if data is binary (Buffer or ArrayBuffer)
 */
export function isBinaryMessage(data: unknown): data is Buffer | ArrayBuffer {
  return Buffer.isBuffer(data) || data instanceof ArrayBuffer;
}

/**
 * Serializes data to MessagePack (binary format).
 *
 * @param data - Data to encode
 * @returns Encoded buffer
 */
export function encodeMsgPack<T>(data: T): Buffer {
  return Buffer.from(encode(data));
}

/**
 * Deserializes MessagePack or JSON automatically.
 *
 * @param raw - Raw message data (string, Buffer, or ArrayBuffer)
 * @returns Decoded data
 */
export function decodeMessage<T>(raw: string | Buffer | ArrayBuffer): T {
  if (typeof raw === "string") {
    return JSON.parse(raw) as T;
  }

  const buffer = raw instanceof ArrayBuffer ? Buffer.from(raw) : raw;

  try {
    return decode(buffer) as T;
  } catch (error) {
    console.error(
      "Failed to decode MessagePack, falling back to JSON:",
      error instanceof Error ? error.message : String(error),
    );
    return JSON.parse(buffer.toString()) as T;
  }
}

/**
 * Hybrid helpers were removed: callers should invoke `encodeMsgPack`/
 * `decodeMessage` or `isBinaryMessage` directly for clarity.
 */
