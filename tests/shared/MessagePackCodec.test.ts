import { describe, it, expect } from "vitest";
import {
  isBinaryMessage,
  encodeMsgPack,
  decodeMessage,
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
      const fallbackBuffer = Buffer.from('{"test":123}');

      expect(decodeMessage(fallbackBuffer)).toEqual({ test: 123 });
    });
  });

});
