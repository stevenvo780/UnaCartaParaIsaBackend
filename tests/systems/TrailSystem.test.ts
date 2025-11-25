import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrailSystem } from "../../src/domain/simulation/systems/TrailSystem";
import { createMockGameState } from "../setup";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";

const emitMovementStarted = (payload: Parameters<typeof simulationEvents.emit>[1]) => {
  simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_STARTED, payload as any);
  simulationEvents.flushEvents();
};

const emitMovementCompleted = (payload: Parameters<typeof simulationEvents.emit>[1]) => {
  simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_COMPLETED, payload as any);
  simulationEvents.flushEvents();
};

describe("TrailSystem", () => {
  let gameState = createMockGameState();
  let trailSystem: TrailSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Walker",
          position: { x: 0, y: 0 },
        },
      ],
    });
    trailSystem = new TrailSystem(gameState);
  });

  afterEach(() => {
    vi.useRealTimers();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("registra segmentos y actualiza heatmap cuando se reporta movimiento", () => {
    emitMovementStarted({
      entityId: "agent-1",
      activityType: "gather",
      destination: { x: 64, y: 0 },
      path: [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 64, y: 0 },
      ],
    });

    const trails = trailSystem.getAllTrails();
    expect(trails).toHaveLength(2);
    expect(trails[0].purpose).toBe("work");

    const hotspots = trailSystem.getTrafficHotspots(1);
    expect(hotspots[0]?.heat).toBeGreaterThan(0);
  });

  it("refuerza senderos recientes cuando la actividad se completa", () => {
    emitMovementStarted({
      entityId: "agent-1",
      activityType: "moving",
      destination: { x: 32, y: 32 },
      path: [
        { x: 0, y: 0 },
        { x: 32, y: 32 },
      ],
    });
    const before = trailSystem.getAllTrails()[0].intensity;

    emitMovementCompleted({
      entityId: "agent-1",
      position: { x: 32, y: 32 },
    });

    const after = trailSystem.getAllTrails()[0].intensity;
    expect(after).toBeGreaterThan(before);
  });

  it("decay aplica y actualiza estadísticas globales", () => {
    emitMovementStarted({
      entityId: "agent-1",
      activityType: "moving",
      destination: { x: 32, y: 0 },
      path: [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
      ],
    });

    vi.setSystemTime(10000);
    trailSystem.update(2000);

    const stats = trailSystem.getStats();
    expect(stats.totalTrails).toBeGreaterThan(0);
    expect(gameState.trails?.trails.length).toBeGreaterThan(0);
    expect(trailSystem.getMostUsedTrails(1)[0].usageCount).toBeGreaterThan(0);
  });
});
