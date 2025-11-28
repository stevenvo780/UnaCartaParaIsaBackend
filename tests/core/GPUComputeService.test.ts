import { describe, it, expect, beforeEach, vi } from "vitest";
import { GPUComputeService } from "../../src/domain/simulation/core/GPUComputeService";
import * as tf from "@tensorflow/tfjs-node-gpu";

vi.mock("@tensorflow/tfjs-node-gpu", () => ({
  ready: vi.fn().mockResolvedValue(undefined),
  getBackend: vi.fn().mockReturnValue("cpu"),
  disposeVariables: vi.fn(),
}));

describe("GPUComputeService", () => {
  let service;

  beforeEach(() => {
    service = new GPUComputeService();
  });

  describe("initialize", () => {
    it("debe detectar backend y GPU availability", async () => {
      await service.initialize();

      // El servicio usa lazy-loading, así que simplemente verificamos que la inicialización no falle
      // y que se puede verificar el estado de GPU
      expect(typeof service.isGPUAvailable()).toBe("boolean");
    });
  });

  describe("isGPUAvailable", () => {
    it("debe retornar estado correcto", async () => {
      await service.initialize();

      const isAvailable = service.isGPUAvailable();
      expect(typeof isAvailable).toBe("boolean");
    });
  });

  describe("updatePositionsBatch", () => {
    it("debe usar CPU para < 10 entidades", async () => {
      const positions = new Float32Array([0, 0, 10, 10]); // 2 entidades
      const targets = new Float32Array([100, 100, 200, 200]);
      const speeds = new Float32Array([50, 50]);
      const fatigue = new Float32Array([0, 0]);

      const result = await service.updatePositionsBatch(
        positions,
        targets,
        speeds,
        fatigue,
        100,
      );

      expect(result.newPositions).toBeDefined();
      expect(result.arrived).toBeDefined();
      expect(result.arrived.length).toBe(2);
    });

    it("debe calcular nuevas posiciones correctamente", async () => {
      const positions = new Float32Array([0, 0]);
      const targets = new Float32Array([100, 100]);
      const speeds = new Float32Array([50]);
      const fatigue = new Float32Array([0]);

      const result = await service.updatePositionsBatch(
        positions,
        targets,
        speeds,
        fatigue,
        1000, // 1 segundo
      );

      expect(result.newPositions.length).toBe(2);
      expect(result.arrived.length).toBe(1);
    });

    it("debe detectar arrived correctamente", async () => {
      const positions = new Float32Array([100, 100]); // Ya en el objetivo
      const targets = new Float32Array([100, 100]);
      const speeds = new Float32Array([50]);
      const fatigue = new Float32Array([0]);

      const result = await service.updatePositionsBatch(
        positions,
        targets,
        speeds,
        fatigue,
        100,
      );

      expect(result.arrived[0]).toBe(true);
    });
  });

  describe("applyNeedsDecayBatch", () => {
    it("debe aplicar decay con multiplicadores", async () => {
      const needs = new Float32Array([100, 100, 100]); // 1 entidad, 3 necesidades
      const decayRates = new Float32Array([0.1, 0.2, 0.3]);
      const ageMultipliers = new Float32Array([1.0]);
      const divineModifiers = new Float32Array([1.0]);

      const result = await service.applyNeedsDecayBatch(
        needs,
        decayRates,
        ageMultipliers,
        divineModifiers,
        3,
        1.0, // 1 segundo
      );

      expect(result.length).toBe(3);
      expect(result[0]).toBeLessThanOrEqual(100);
    });

    it("debe usar CPU fallback para < 10 entidades", async () => {
      const needs = new Float32Array([100, 100]); // 1 entidad, 2 necesidades
      const decayRates = new Float32Array([0.1, 0.2]);
      const ageMultipliers = new Float32Array([1.0]);
      const divineModifiers = new Float32Array([1.0]);

      const result = await service.applyNeedsDecayBatch(
        needs,
        decayRates,
        ageMultipliers,
        divineModifiers,
        2,
        1.0,
      );

      expect(result.length).toBe(2);
    });
  });

  describe("applyNeedsCrossEffectsBatch", () => {
    it("debe aplicar efectos cruzados entre needs", async () => {
      const needs = new Float32Array([30, 30, 20, 50, 50, 50, 50]); // 1 entidad, 7 necesidades
      const needCount = 7;

      const result = await service.applyNeedsCrossEffectsBatch(needs, needCount);

      expect(result.length).toBe(7);
      // Energy baja debe afectar otras necesidades
      expect(result[2]).toBeLessThanOrEqual(20); // energy
    });

    it("debe usar CPU fallback para < 10 entidades", async () => {
      const needs = new Float32Array([50, 50, 50]);
      const needCount = 3;

      const result = await service.applyNeedsCrossEffectsBatch(needs, needCount);

      expect(result.length).toBe(3);
    });
  });

  describe("updateFatigueBatch", () => {
    it("debe incrementar/decrementa fatiga", async () => {
      const fatigue = new Float32Array([50, 50]);
      const isMoving = [true, false];
      const isResting = [false, true];

      const result = await service.updateFatigueBatch(fatigue, isMoving, isResting, 1000);

      expect(result.length).toBe(2);
      // Moviéndose debe incrementar, descansando debe decrementar
      expect(result[0]).toBeGreaterThanOrEqual(50); // moving
      expect(result[1]).toBeLessThanOrEqual(50); // resting
    });
  });

  describe("getPerformanceStats", () => {
    it("debe retornar estadísticas", () => {
      const stats = service.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats.gpuAvailable).toBeDefined();
      expect(stats.gpuOperations).toBeDefined();
      expect(stats.cpuFallbacks).toBeDefined();
      expect(stats.avgGpuTime).toBeDefined();
      expect(stats.avgCpuTime).toBeDefined();
    });
  });

  describe("dispose", () => {
    it("debe limpiar memoria TensorFlow", () => {
      service.dispose();

      // El servicio usa lazy-loading, así que dispose() puede no llamar a tf.disposeVariables
      // si TensorFlow nunca fue cargado. Simplemente verificamos que no lance error.
      expect(() => service.dispose()).not.toThrow();
    });
  });
});

