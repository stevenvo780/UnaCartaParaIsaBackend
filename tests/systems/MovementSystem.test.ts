import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MovementSystem } from "../../src/domain/simulation/systems/agents/movement/MovementSystem";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/domain/types/game-types";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events";

const entityId = "agent-1";

const createZone = () => ({
  id: "zone-1",
  type: "town",
  bounds: { x: 100, y: 100, width: 50, height: 50 },
});

describe("MovementSystem", () => {
  let gameState: GameState;
  let system: MovementSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [{ id: entityId, position: { x: 0, y: 0 } } as any],
      entities: [{ id: entityId, position: { x: 0, y: 0 }, isDead: false } as any],
      zones: [createZone() as any],
      worldSize: { width: 512, height: 512 },
    });
    system = new MovementSystem();
    // Manually set the gameState since @inject doesn't work in tests
    (system as any).gameState = gameState;
    // Initialize the system manually (normally done by @postConstruct)
    (system as any).pathfinder.setAcceptableTiles([0]);
    (system as any).pathfinder.enableDiagonals();
    (system as any).gridWidth = 8;
    (system as any).gridHeight = 8;
    
    system.initializeEntityMovement(entityId, { x: 0, y: 0 });
    emitSpy = vi.spyOn(simulationEvents, "emit");
  });

  afterEach(() => {
    emitSpy.mockRestore();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
    vi.restoreAllMocks();
  });

  it("moveToPoint inicia movimiento y emite MOVEMENT_ACTIVITY_STARTED", () => {
    const result = system.moveToPoint(entityId, 64, 64);
    expect(result).toBe(true);
    expect(system.isMovingToPosition(entityId, 64, 64)).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.MOVEMENT_ACTIVITY_STARTED,
      expect.objectContaining({ entityId }),
    );
  });

  it("stopMovement detiene al agente y limpia el estado", () => {
    system.moveToPoint(entityId, 64, 64);
    const stopped = system.stopMovement(entityId);
    expect(stopped).toBe(true);
    const state = system.getEntityMovementState(entityId);
    expect(state?.isMoving).toBe(false);
    expect(state?.targetPosition).toBeUndefined();
  });

  it("moveToZone usa enqueuePathfinding y configura el estado", () => {
    const path = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const enqueueSpy = vi
      .spyOn(system as any, "enqueuePathfinding")
      .mockImplementation((_id, _from, _to, callback) => {
        callback({ success: true, path, distance: 141, estimatedTime: 5000 });
      });

    const moved = system.moveToZone(entityId, "zone-1");
    expect(moved).toBe(true);
    expect(system.isMovingToZone(entityId, "zone-1")).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.MOVEMENT_ACTIVITY_STARTED,
      expect.objectContaining({ entityId, path }),
    );
    enqueueSpy.mockRestore();
  });

  it("completeMovement emite eventos de finalización y actualiza estado", () => {
    system.moveToPoint(entityId, 64, 64);
    const state = system.getEntityMovementState(entityId)!;
    (system as any).completeMovement(state);

    expect(state.isMoving).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.MOVEMENT_ACTIVITY_COMPLETED,
      expect.objectContaining({ entityId }),
    );
  });

  it("getEntityMovementState retorna el estado actual", () => {
    const state = system.getEntityMovementState(entityId);
    expect(state?.entityId).toBe(entityId);
    expect(system.hasMovementState(entityId)).toBe(true);
  });
});
