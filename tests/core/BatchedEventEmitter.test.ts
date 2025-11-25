import { describe, it, expect, beforeEach } from "vitest";
import { BatchedEventEmitter } from "../../src/domain/simulation/core/BatchedEventEmitter";

describe("BatchedEventEmitter", () => {
  let emitter: BatchedEventEmitter;
  let listener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitter = new BatchedEventEmitter();
    listener = vi.fn();
  });

  describe("emit", () => {
    it("debe encolar evento cuando batching habilitado", () => {
      emitter.on("test-event", listener);

      emitter.emit("test-event", { data: "test" });

      // No debe llamar inmediatamente
      expect(listener).not.toHaveBeenCalled();

      // Después de flush debe llamar
      emitter.flushEvents();
      expect(listener).toHaveBeenCalledWith({ data: "test" });
    });

    it("debe emitir inmediatamente cuando batching deshabilitado", () => {
      emitter.setBatchingEnabled(false);
      emitter.on("test-event", listener);

      emitter.emit("test-event", { data: "test" });

      expect(listener).toHaveBeenCalledWith({ data: "test" });
    });
  });

  describe("queueEvent", () => {
    it("debe agregar evento a la cola", () => {
      emitter.on("test-event", listener);

      emitter.queueEvent("test-event", { data: "test" });

      expect(emitter.getQueueSize()).toBe(1);
      expect(listener).not.toHaveBeenCalled();

      emitter.flushEvents();
      expect(listener).toHaveBeenCalled();
    });

    it("debe emitir inmediatamente si batching deshabilitado", () => {
      emitter.setBatchingEnabled(false);
      emitter.on("test-event", listener);

      emitter.queueEvent("test-event", { data: "test" });

      expect(listener).toHaveBeenCalled();
      expect(emitter.getQueueSize()).toBe(0);
    });
  });

  describe("flushEvents", () => {
    it("debe procesar todos los eventos en cola", () => {
      emitter.on("event1", listener);
      emitter.on("event2", listener);

      emitter.queueEvent("event1", { data: "1" });
      emitter.queueEvent("event2", { data: "2" });

      expect(emitter.getQueueSize()).toBe(2);

      emitter.flushEvents();

      expect(emitter.getQueueSize()).toBe(0);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("no debe hacer nada si cola vacía", () => {
      emitter.flushEvents();

      expect(emitter.getQueueSize()).toBe(0);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("setBatchingEnabled", () => {
    it("debe cambiar modo y flush si deshabilita", () => {
      emitter.on("test-event", listener);
      emitter.queueEvent("test-event", { data: "test" });

      expect(emitter.getQueueSize()).toBe(1);

      emitter.setBatchingEnabled(false);

      expect(emitter.getQueueSize()).toBe(0);
      expect(listener).toHaveBeenCalled();
    });

    it("debe cambiar modo sin flush si habilita", () => {
      emitter.setBatchingEnabled(false);
      emitter.on("test-event", listener);
      emitter.emit("test-event", { data: "test" });

      expect(listener).toHaveBeenCalledTimes(1);

      emitter.setBatchingEnabled(true);
      emitter.emit("test-event", { data: "test2" });

      // El segundo no debe llamarse hasta flush
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearQueue", () => {
    it("debe vaciar la cola sin procesar", () => {
      emitter.on("test-event", listener);
      emitter.queueEvent("test-event", { data: "test" });

      expect(emitter.getQueueSize()).toBe(1);

      emitter.clearQueue();

      expect(emitter.getQueueSize()).toBe(0);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("getQueueSize", () => {
    it("debe retornar tamaño de cola", () => {
      expect(emitter.getQueueSize()).toBe(0);

      emitter.queueEvent("event1", {});
      expect(emitter.getQueueSize()).toBe(1);

      emitter.queueEvent("event2", {});
      expect(emitter.getQueueSize()).toBe(2);

      emitter.flushEvents();
      expect(emitter.getQueueSize()).toBe(0);
    });
  });
});

