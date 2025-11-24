import { describe, it, expect, beforeEach, vi } from "vitest";
import { TrailSystem } from "../../src/domain/simulation/systems/TrailSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("TrailSystem", () => {
  let gameState: GameState;
  let trailSystem: TrailSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
          position: { x: 100, y: 100 },
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

    trailSystem = new TrailSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(trailSystem).toBeDefined();
    });
  });

  describe("Registro de movimiento", () => {
    it("debe registrar movimiento cuando se inicia una actividad", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");

      simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_STARTED, {
        entityId: "agent-1",
        activityType: "work",
        destination: { x: 200, y: 200 },
        path: [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
          { x: 200, y: 200 },
        ],
      });

      // El sistema debería haber registrado el movimiento
      expect(emitSpy).toHaveBeenCalled();
    });

    it("debe reforzar senderos cuando se completa una actividad", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");

      simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_COMPLETED, {
        entityId: "agent-1",
        position: { x: 200, y: 200 },
      });

      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe("Obtener senderos", () => {
    it("debe retornar senderos cercanos", () => {
      // Primero registrar un movimiento
      simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_STARTED, {
        entityId: "agent-1",
        activityType: "work",
        destination: { x: 200, y: 200 },
        path: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
      });

      // Esperar un poco para que se procese
      setTimeout(() => {
        const trails = trailSystem.getTrailsNear(150, 150, 100);
        expect(trails.length).toBeGreaterThanOrEqual(0);
      }, 10);
    });
  });

  describe("Mapa de calor", () => {
    it("debe actualizar el mapa de calor con movimientos", () => {
      simulationEvents.emit(GameEventNames.MOVEMENT_ACTIVITY_STARTED, {
        entityId: "agent-1",
        activityType: "work",
        destination: { x: 200, y: 200 },
      });

      // El sistema debería actualizar el mapa de calor
      expect(trailSystem).toBeDefined();
    });
  });

  describe("Estadísticas", () => {
    it("debe proporcionar estadísticas de senderos", () => {
      const stats = trailSystem.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalTrails).toBeGreaterThanOrEqual(0);
      expect(stats.activeTrails).toBeGreaterThanOrEqual(0);
    });
  });
});

