import { describe, it, expect, beforeEach } from "vitest";
import { MovementBatchProcessor } from "../../src/domain/simulation/systems/MovementBatchProcessor";
import type { EntityMovementState } from "../../src/domain/simulation/systems/MovementSystem";

function createMovementState(
  overrides: Partial<EntityMovementState> = {},
): EntityMovementState {
  return {
    entityId: "entity-1",
    currentPosition: { x: 0, y: 0 },
    targetPosition: { x: 10, y: 0 },
    startPosition: { x: 0, y: 0 },
    targetZone: undefined,
    isMoving: true,
    movementStartTime: Date.now(),
    estimatedArrivalTime: Date.now() + 1000,
    currentPath: [],
    currentActivity: "moving",
    activityStartTime: Date.now(),
    activityDuration: 0,
    fatigue: 0,
    ...overrides,
  };
}

describe("MovementBatchProcessor", () => {
  let processor: MovementBatchProcessor;
  let states: Map<string, EntityMovementState>;

  beforeEach(() => {
    processor = new MovementBatchProcessor();
    states = new Map();
    states.set("entity-1", createMovementState());
  });

  it("debe reconstruir buffers correctamente", () => {
    processor.rebuildBuffers(states);

    expect(processor.getPositionBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getTargetBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getFatigueBuffer()).toBeInstanceOf(Float32Array);
    expect(processor.getEntityIdArray()).toHaveLength(1);
  });

  it("debe actualizar posiciones en CPU fallback", () => {
    processor.rebuildBuffers(states);

    const result = processor.updatePositionsBatch(1000); // 1 segundo

    expect(result.updated).toEqual([true]);
    expect(result.arrived[0]).toBeFalsy();

    processor.syncToStates(states);
    const updatedState = states.get("entity-1")!;
    expect(updatedState.currentPosition.x).toBeGreaterThan(0);
  });

  it("debe marcar arrived cuando alcanza el objetivo", () => {
    states.set(
      "entity-1",
      createMovementState({
        currentPosition: { x: 0, y: 0 },
        targetPosition: { x: 1, y: 0 },
      }),
    );
    processor.rebuildBuffers(states);

    const result = processor.updatePositionsBatch(5000); // 5 segundos
    expect(result.arrived[0]).toBe(true);
  });

  it("debe actualizar fatiga en CPU fallback", () => {
    processor.rebuildBuffers(states);
    const fatigueBefore = processor.getFatigueBuffer()![0];

    processor.updateFatigueBatch([true], [false], 1000);

    const fatigueAfter = processor.getFatigueBuffer()![0];
    expect(fatigueAfter).toBeGreaterThanOrEqual(fatigueBefore);
  });
});

