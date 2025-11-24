import { describe, it, expect, beforeEach, vi } from "vitest";
import { MovementSystem } from "../../src/domain/simulation/systems/MovementSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("MovementSystem", () => {
  let gameState: GameState;
  let movementSystem: MovementSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "zone-1",
          type: "rest",
          bounds: { x: 100, y: 100, width: 200, height: 200 },
        },
        {
          id: "zone-2",
          type: "resource",
          bounds: { x: 500, y: 500, width: 200, height: 200 },
        },
      ],
      worldSize: { width: 3200, height: 3200 },
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
          position: { x: 150, y: 150 },
          ageYears: 25,
          lifeStage: "adult",
          sex: "female",
          generation: 0,
          birthTimestamp: Date.now(),
          immortal: false,
          traits: {},
          socialStatus: "commoner",
        },
      ],
    });

    movementSystem = new MovementSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(movementSystem).toBeDefined();
    });

    it("debe inicializar el estado de movimiento de una entidad", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const state = movementSystem.getEntityMovementState("agent-1");
      expect(state).toBeDefined();
      expect(state?.currentPosition).toEqual({ x: 100, y: 100 });
      expect(state?.isMoving).toBe(false);
      expect(state?.currentActivity).toBe("idle");
    });
  });

  describe("Movimiento a punto", () => {
    it("debe mover entidad a un punto específico", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const result = movementSystem.moveToPoint("agent-1", 200, 200);
      expect(result).toBe(true);

      const state = movementSystem.getEntityMovementState("agent-1");
      expect(state?.isMoving).toBe(true);
      expect(state?.targetPosition).toEqual({ x: 200, y: 200 });
      expect(state?.currentActivity).toBe("moving");
    });

    it("debe limitar el movimiento dentro de los límites del mundo", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      movementSystem.moveToPoint("agent-1", 10000, 10000);
      const state = movementSystem.getEntityMovementState("agent-1");
      expect(state?.targetPosition?.x).toBeLessThanOrEqual(3200);
      expect(state?.targetPosition?.y).toBeLessThanOrEqual(3200);
    });
  });

  describe("Movimiento a zona", () => {
    it("debe mover entidad a una zona específica", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const result = movementSystem.moveToZone("agent-1", "zone-2");
      expect(result).toBe(true);

      const state = movementSystem.getEntityMovementState("agent-1");
      expect(state?.isMoving).toBe(true);
      expect(state?.targetZone).toBe("zone-2");
    });

    it("debe retornar false si la entidad no existe", () => {
      const result = movementSystem.moveToZone("non-existent", "zone-1");
      expect(result).toBe(false);
    });

    it("debe retornar false si la zona no existe", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const result = movementSystem.moveToZone("agent-1", "non-existent");
      expect(result).toBe(false);
    });
  });

  describe("Actualización de movimiento", () => {
    it("debe actualizar la posición durante el movimiento", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      movementSystem.moveToPoint("agent-1", 200, 200);

      const initialState = movementSystem.getEntityMovementState("agent-1");
      expect(initialState?.isMoving).toBe(true);

      // Simular actualización
      movementSystem.update(100);

      const updatedState = movementSystem.getEntityMovementState("agent-1");
      expect(updatedState?.currentPosition.x).toBeGreaterThan(100);
      expect(updatedState?.currentPosition.y).toBeGreaterThan(100);
    });

    it("debe completar el movimiento cuando llega al destino", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      movementSystem.moveToPoint("agent-1", 102, 102);

      // Simular múltiples actualizaciones hasta llegar
      for (let i = 0; i < 100; i++) {
        movementSystem.update(100);
        const state = movementSystem.getEntityMovementState("agent-1");
        if (!state?.isMoving) break;
      }

      const finalState = movementSystem.getEntityMovementState("agent-1");
      expect(finalState?.isMoving).toBe(false);
      expect(finalState?.currentActivity).toBe("idle");
    });
  });

  describe("Eventos", () => {
    it("debe emitir evento cuando llega a una zona", (done) => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      movementSystem.moveToZone("agent-1", "zone-2");

      simulationEvents.once(GameEventNames.MOVEMENT_ARRIVED_AT_ZONE, (data) => {
        expect(data.entityId).toBe("agent-1");
        expect(data.zoneId).toBe("zone-2");
        done();
      });

      // Simular llegada
      const state = movementSystem.getEntityMovementState("agent-1");
      if (state) {
        state.currentPosition = state.targetPosition || state.currentPosition;
        state.isMoving = false;
        movementSystem.update(100);
      }
    });
  });

  describe("Estado de movimiento", () => {
    it("debe retornar undefined para entidad no inicializada", () => {
      const state = movementSystem.getEntityMovementState("non-existent");
      expect(state).toBeUndefined();
    });

    it("debe retornar el estado correcto para entidad inicializada", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const state = movementSystem.getEntityMovementState("agent-1");
      expect(state).toBeDefined();
      expect(state?.entityId).toBe("agent-1");
      expect(state?.fatigue).toBe(0);
    });
  });

  describe("Fatiga", () => {
    it("debe aumentar la fatiga durante el movimiento", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      movementSystem.moveToPoint("agent-1", 200, 200);

      const initialState = movementSystem.getEntityMovementState("agent-1");
      expect(initialState?.fatigue).toBe(0);

      movementSystem.update(1000);
      const updatedState = movementSystem.getEntityMovementState("agent-1");
      expect(updatedState?.fatigue).toBeGreaterThan(0);
    });

    it("debe reducir la fatiga cuando está en reposo", () => {
      movementSystem.initializeEntityMovement("agent-1", { x: 100, y: 100 });
      const state = movementSystem.getEntityMovementState("agent-1");
      if (state) {
        state.fatigue = 50;
        state.currentActivity = "resting";
      }

      movementSystem.update(1000);
      const updatedState = movementSystem.getEntityMovementState("agent-1");
      expect(updatedState?.fatigue).toBeLessThan(50);
    });
  });
});

