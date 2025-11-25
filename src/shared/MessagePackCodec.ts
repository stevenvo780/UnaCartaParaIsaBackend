/**
 * MessagePack Codec para WebSocket
 *
 * Proporciona serialización/deserialización binaria eficiente.
 * ~30-50% más compacto que JSON, especialmente para datos numéricos (posiciones, stats).
 *
 * Compatible con JSON como fallback para debugging.
 */

import { encode, decode } from "@msgpack/msgpack";

export type SerializedData = Buffer | string;

/**
 * Detecta si el mensaje es MessagePack (binario) o JSON (texto)
 */
export function isBinaryMessage(data: unknown): data is Buffer | ArrayBuffer {
  return Buffer.isBuffer(data) || data instanceof ArrayBuffer;
}

/**
 * Serializa datos a MessagePack (binario)
 */
export function encodeMsgPack<T>(data: T): Buffer {
  return Buffer.from(encode(data));
}

/**
 * Deserializa MessagePack o JSON automáticamente
 */
export function decodeMessage<T>(raw: string | Buffer | ArrayBuffer): T {
  if (typeof raw === "string") {
    // Fallback JSON para compatibilidad
    return JSON.parse(raw) as T;
  }

  const buffer = raw instanceof ArrayBuffer ? Buffer.from(raw) : raw;

  // Intentar MessagePack primero, luego JSON como fallback
  try {
    return decode(buffer) as T;
  } catch {
    // Si falla MessagePack, intentar como JSON string
    return JSON.parse(buffer.toString()) as T;
  }
}

/**
 * Envía mensaje por WebSocket con MessagePack
 */
export function sendBinaryMessage<T>(
  ws: { send: (data: Buffer | string) => void; readyState?: number },
  data: T,
): void {
  // readyState 1 = OPEN
  if (ws.readyState !== undefined && ws.readyState !== 1) {
    return;
  }
  ws.send(encodeMsgPack(data));
}

/**
 * Envía mensaje por WebSocket como JSON (para debugging o compatibilidad)
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
 * Codec híbrido que detecta y usa el formato apropiado
 */
export const MessagePackCodec = {
  encode: encodeMsgPack,
  decode: decodeMessage,
  sendBinary: sendBinaryMessage,
  sendJson: sendJsonMessage,
  isBinary: isBinaryMessage,
};

export default MessagePackCodec;
