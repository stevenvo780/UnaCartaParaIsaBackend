import { describe, it, expect, beforeEach } from "vitest";
import { NeedsBatchProcessor } from "../../src/domain/simulation/systems/NeedsBatchProcessor";
import type { EntityNeedsData } from "../../src/domain/types/simulation/needs";

function createNeeds(): EntityNeedsData {
  return {
    hunger: 80,
    thirst: 90,
    energy: 50,
    hygiene: 70,
    social: 60,
    fun: 55,
    mentalHealth: 65,
  };
}

describe("NeedsBatchProcessor", () => {
  let processor: NeedsBatchProcessor;
  let needsMap: Map<string, EntityNeedsData>;

  beforeEach(() => {
    processor = new NeedsBatchProcessor();
    needsMap = new Map();
    needsMap.set("entity-1", createNeeds());
  });

  it("debe reconstruir buffers correctamente", () => {
    processor.rebuildBuffers(needsMap);

    expect(processor.getNeedsBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getEntityIdArray()).toHaveLength(1);
    expect(processor.isDirty()).toBe(false);
  });

  it("debe aplicar decay en CPU fallback", () => {
    processor.rebuildBuffers(needsMap);
    const decayRates = new Float32Array([0.1, 0.1, 0.2, 0.05, 0.05, 0.05, 0.05]);
    const multipliers = new Float32Array([1]);

    processor.applyDecayBatch(decayRates, multipliers, multipliers, 10);
    processor.syncToMap(needsMap);

    const updated = needsMap.get("entity-1")!;
    expect(updated.hunger).toBeLessThan(80);
    expect(updated.thirst).toBeLessThan(90);
    expect(processor.isDirty()).toBe(true);
  });

  it("debe aplicar efectos cruzados en CPU fallback", () => {
    const lowNeeds = createNeeds();
    lowNeeds.energy = 10;
    lowNeeds.hunger = 5;
    lowNeeds.thirst = 5;
    needsMap.set("entity-1", lowNeeds);

    processor.rebuildBuffers(needsMap);
    processor.applyCrossEffectsBatch();
    processor.syncToMap(needsMap);

    const updated = needsMap.get("entity-1")!;
    expect(updated.social).toBeLessThan(60);
    expect(updated.mentalHealth).toBeLessThan(65);
  });

  it("debe exponer getters y setters de necesidades", () => {
    processor.rebuildBuffers(needsMap);
    const currentValue = processor.getNeedValue(0, 0);
    expect(currentValue).toBeGreaterThan(0);

    processor.setNeedValue(0, 0, 30);
    expect(processor.getNeedValue(0, 0)).toBe(30);
  });
});

