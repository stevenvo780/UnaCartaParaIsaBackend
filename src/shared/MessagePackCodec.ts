/**
 * MessagePack codec for WebSocket communication.
 *
 * Provides efficient binary serialization/deserialization.
 * ~30-50% more compact than JSON, especially for numeric data (positions, stats).
 *
 * Compatible with JSON as fallback for debugging.
 */

import { encode, decode } from "@msgpack/msgpack";

export type SerializedData = Buffer | string;

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
  } catch {
    return JSON.parse(buffer.toString()) as T;
  }
}

/**
 * Sends a message via WebSocket using MessagePack encoding.
 *
 * @param ws - WebSocket instance
 * @param data - Data to send
 */
export function sendBinaryMessage<T>(
  ws: { send: (data: Buffer | string) => void; readyState?: number },
  data: T,
): void {
  if (ws.readyState !== undefined && ws.readyState !== 1) {
    return;
  }
  ws.send(encodeMsgPack(data));
}

/**
 * Sends a message via WebSocket as JSON (for debugging or compatibility).
 *
 * @param ws - WebSocket instance
 * @param data - Data to send
 */
export function sendJsonMessage<T>(
  ws: { send: (data: string) => void; readyState?: number },
  data: T,
): void {
  if (ws.readyState !== undefined && ws.readyState !== 1) {
    return;
  }
  ws.send(JSON.stringify(data));
}

/**
 * Hybrid codec that detects and uses the appropriate format.
 */
export const MessagePackCodec = {
  encode: encodeMsgPack,
  decode: decodeMessage,
  sendBinary: sendBinaryMessage,
  sendJson: sendJsonMessage,
  isBinary: isBinaryMessage,
};

export default MessagePackCodec;
