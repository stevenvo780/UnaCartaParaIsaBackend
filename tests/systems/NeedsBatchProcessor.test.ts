import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EntityNeedsData } from "../../src/domain/types/simulation/needs";
import { NeedsBatchProcessor } from "../../src/domain/simulation/systems/NeedsBatchProcessor";
import { createMockGPUService } from "../setup";

const createNeeds = (overrides: Partial<EntityNeedsData> = {}): EntityNeedsData => ({
  hunger: 80,
  thirst: 70,
  energy: 65,
  hygiene: 60,
  social: 55,
  fun: 50,
  mentalHealth: 45,
  ...overrides,
});

describe("NeedsBatchProcessor", () => {
  let needsMap: Map<string, EntityNeedsData>;
  let processor: NeedsBatchProcessor;

  beforeEach(() => {
    needsMap = new Map([
      ["agent-1", createNeeds()],
      ["agent-2", createNeeds({ hunger: 20, thirst: 25, energy: 15, social: 80, fun: 75, mentalHealth: 90 })],
    ]);
    const gpuService = createMockGPUService();
    processor = new NeedsBatchProcessor(gpuService as any);
  });

  it("rebuildBuffers construye el buffer de necesidades", () => {
    processor.rebuildBuffers(needsMap);
    expect(processor.getNeedsBuffer()).toEqual(
      new Float32Array([
        80, 70, 65, 60, 55, 50, 45,
        20, 25, 15, 60, 80, 75, 90,
      ]),
    );
    expect(processor.getEntityIdArray()).toEqual(["agent-1", "agent-2"]);
    expect(processor.isDirty()).toBe(false);
  });

  it("rebuildBuffers limpia buffers cuando la entrada está vacía", () => {
    processor.rebuildBuffers(new Map());
    expect(processor.getNeedsBuffer()).toBeNull();
    expect(processor.getEntityIdArray()).toEqual([]);
    expect(processor.isDirty()).toBe(false);
  });

  it("applyDecayBatch aplica decaimiento en CPU", () => {
    processor.rebuildBuffers(needsMap);
    const decayRates = new Float32Array([0.5, 1, 2, 0, 0, 0, 0]);
    const ageMultipliers = new Float32Array([1, 2]);
    const divineModifiers = new Float32Array([1, 1]);

    processor.applyDecayBatch(decayRates, ageMultipliers, divineModifiers, 10);

    expect(processor.getNeedsBuffer()).toEqual(
      new Float32Array([
        75, 60, 45, 60, 55, 50, 45,
        10, 5, 0, 60, 80, 75, 90,
      ]),
    );
    expect(processor.isDirty()).toBe(true);
  });

  it("applyDecayBatch usa GPU cuando está disponible", () => {
    const gpuService = {
      isGPUAvailable: () => true,
      applyNeedsDecayBatch: vi.fn(() =>
        new Float32Array([
          40, 50, 60, 70, 80, 90, 100,
          30, 40, 50, 60, 70, 80, 90,
        ]),
      ),
    } as any;
    processor = new NeedsBatchProcessor(gpuService);
    processor.rebuildBuffers(needsMap);

    const decayRates = new Float32Array(7).fill(1);
    const ones = new Float32Array([1, 1]);
    processor.applyDecayBatch(decayRates, ones, ones, 1);

    expect(gpuService.applyNeedsDecayBatch).toHaveBeenCalled();
    expect(processor.getNeedsBuffer()).toEqual(
      new Float32Array([
        40, 50, 60, 70, 80, 90, 100,
        30, 40, 50, 60, 70, 80, 90,
      ]),
    );
  });

  it("applyCrossEffectsBatch ajusta necesidades en CPU", () => {
    processor.rebuildBuffers(needsMap);
    processor.applyCrossEffectsBatch();

    const buffer = processor.getNeedsBuffer();
    expect(buffer).toBeDefined();
    const asArray = Array.from(buffer!);
    // Social/fun/mental se ven afectados para agent-2 por energía baja
    expect(asArray.slice(7, 14)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(asArray[11]).toBeLessThan(80);
    expect(asArray[12]).toBeLessThan(75);
    expect(asArray[13]).toBeLessThan(90);
  });

  it("applyCrossEffectsBatch usa GPU cuando está disponible", () => {
    const gpuService = {
      isGPUAvailable: () => true,
      applyNeedsCrossEffectsBatch: vi.fn(() => new Float32Array(14).fill(10)),
    } as any;
    processor = new NeedsBatchProcessor(gpuService);
    processor.rebuildBuffers(needsMap);

    processor.applyCrossEffectsBatch();

    expect(gpuService.applyNeedsCrossEffectsBatch).toHaveBeenCalled();
    expect(processor.getNeedsBuffer()).toEqual(new Float32Array(14).fill(10));
  });

  it("syncToMap copia valores desde los buffers", () => {
    processor.rebuildBuffers(needsMap);
    const buffer = processor.getNeedsBuffer()!;
    buffer.set([
      1, 2, 3, 4, 5, 6, 7,
      8, 9, 10, 11, 12, 13, 14,
    ]);

    processor.syncToMap(needsMap);

    expect(needsMap.get("agent-1")).toEqual({
      hunger: 1,
      thirst: 2,
      energy: 3,
      hygiene: 4,
      social: 5,
      fun: 6,
      mentalHealth: 7,
    });
    expect(needsMap.get("agent-2")).toEqual({
      hunger: 8,
      thirst: 9,
      energy: 10,
      hygiene: 11,
      social: 12,
      fun: 13,
      mentalHealth: 14,
    });
  });

  it("setNeedValue aplica clamps y marca dirty", () => {
    processor.rebuildBuffers(needsMap);
    processor.setNeedValue(0, 0, 150);
    processor.setNeedValue(1, 1, -50);

    const buffer = processor.getNeedsBuffer()!;
    expect(buffer[0]).toBe(100);
    expect(buffer[8]).toBe(0);
    expect(processor.isDirty()).toBe(true);
  });
});
