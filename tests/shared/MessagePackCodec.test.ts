import { describe, it, expect, vi } from "vitest";
import {
  isBinaryMessage,
  encodeMsgPack,
  decodeMessage,
  sendBinaryMessage,
  sendJsonMessage,
} from "../../src/shared/MessagePackCodec";

describe("MessagePackCodec", () => {
  describe("isBinaryMessage", () => {
    it("debe detectar Buffer", () => {
      const buffer = Buffer.from("test");
      expect(isBinaryMessage(buffer)).toBe(true);
    });

    it("debe detectar ArrayBuffer", () => {
      const arrayBuffer = new ArrayBuffer(8);
      expect(isBinaryMessage(arrayBuffer)).toBe(true);
    });

    it("debe retornar false para string", () => {
      expect(isBinaryMessage("test")).toBe(false);
    });
  });

  describe("encodeMsgPack", () => {
    it("debe serializar a Buffer", () => {
      const data = { test: "value", number: 42 };
      const encoded = encodeMsgPack(data);

      expect(Buffer.isBuffer(encoded)).toBe(true);
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe("decodeMessage", () => {
    it("debe deserializar string JSON", () => {
      const json = '{"test":"value","number":42}';
      const decoded = decodeMessage(json);

      expect(decoded).toEqual({ test: "value", number: 42 });
    });

    it("debe deserializar Buffer MessagePack", () => {
      const data = { test: "value", number: 42 };
      const encoded = encodeMsgPack(data);
      const decoded = decodeMessage(encoded);

      expect(decoded).toEqual(data);
    });

    it("debe hacer fallback a JSON si MsgPack falla", () => {
      const invalidMsgPack = Buffer.from("invalid");
      // Debe intentar parsear como JSON
      expect(() => {
        decodeMessage(invalidMsgPack);
      }).not.toThrow();
    });
  });

  describe("sendBinaryMessage", () => {
    it("debe enviar por WebSocket", () => {
      const sendFn = vi.fn();
      const ws = {
        send: sendFn,
        readyState: 1, // OPEN
      };

      const data = { test: "value" };
      sendBinaryMessage(ws as any, data);

      expect(sendFn).toHaveBeenCalled();
      const sentData = sendFn.mock.calls[0][0];
      expect(Buffer.isBuffer(sentData)).toBe(true);
    });

    it("no debe enviar si ws no está open", () => {
      const sendFn = vi.fn();
      const ws = {
        send: sendFn,
        readyState: 0, // CONNECTING
      };

      const data = { test: "value" };
      sendBinaryMessage(ws as any, data);

      expect(sendFn).not.toHaveBeenCalled();
    });
  });

  describe("sendJsonMessage", () => {
    it("debe enviar JSON por WebSocket", () => {
      const sendFn = vi.fn();
      const ws = {
        send: sendFn,
        readyState: 1,
      };

      const data = { test: "value", number: 42 };
      sendJsonMessage(ws as any, data);

      expect(sendFn).toHaveBeenCalled();
      const sentData = sendFn.mock.calls[0][0];
      expect(typeof sentData).toBe("string");
      expect(JSON.parse(sentData)).toEqual(data);
    });

    it("no debe enviar si ws no está open", () => {
      const sendFn = vi.fn();
      const ws = {
        send: sendFn,
        readyState: 2, // CLOSING
      };

      const data = { test: "value" };
      sendJsonMessage(ws as any, data);

      expect(sendFn).not.toHaveBeenCalled();
    });
  });
});

