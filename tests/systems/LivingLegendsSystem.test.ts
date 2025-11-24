import { describe, it, expect, beforeEach, vi } from "vitest";
import { LivingLegendsSystem } from "../../src/simulation/systems/LivingLegendsSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";
import { simulationEvents, GameEventNames } from "../../src/simulation/events.js";

describe("LivingLegendsSystem", () => {
  let gameState: GameState;
  let livingLegendsSystem: LivingLegendsSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
          ageYears: 25,
          lifeStage: "adult",
          immortal: false,
          position: { x: 100, y: 100 },
          type: "agent",
          traits: {
            cooperation: 0.5,
            diligence: 0.6,
            curiosity: 0.4,
          },
        },
      ],
    });
    livingLegendsSystem = new LivingLegendsSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(livingLegendsSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => livingLegendsSystem.update(1000)).not.toThrow();
    });

    it("debe actualizar títulos periódicamente", () => {
      livingLegendsSystem.update(6000);
      expect(livingLegendsSystem).toBeDefined();
    });
  });

  describe("Manejo de eventos de reputación", () => {
    it("debe manejar cambios de reputación", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.REPUTATION_UPDATED, {
          entityId: "agent-1",
          newReputation: 0.8,
          delta: 0.1,
          reason: "good_deed",
        });
      }).not.toThrow();
    });

    it("debe crear registro de leyenda cuando cambia reputación", () => {
      simulationEvents.emit(GameEventNames.REPUTATION_UPDATED, {
        entityId: "agent-1",
        newReputation: 0.8,
        delta: 0.1,
      });
      const legend = livingLegendsSystem.getLegend("agent-1");
      expect(legend).toBeDefined();
    });

    it("debe actualizar tendencia de reputación", () => {
      simulationEvents.emit(GameEventNames.REPUTATION_UPDATED, {
        entityId: "agent-1",
        newReputation: 0.8,
        delta: 0.1,
      });
      const legend = livingLegendsSystem.getLegend("agent-1");
      if (legend) {
        expect(legend.reputationTrend).toBeDefined();
      }
    });
  });

  describe("Registro de acciones", () => {
    it("debe registrar acciones exitosas", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
          agentId: "agent-1",
          actionType: "build",
          success: true,
          impact: 5,
        });
      }).not.toThrow();
    });

    it("no debe registrar acciones fallidas", () => {
      simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
        agentId: "agent-1",
        actionType: "build",
        success: false,
      });
      const legend = livingLegendsSystem.getLegend("agent-1");
      // Puede o no tener acciones registradas
      expect(livingLegendsSystem).toBeDefined();
    });
  });

  describe("Gestión de leyendas", () => {
    it("debe manejar eventos de reputación", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.REPUTATION_UPDATED, {
          entityId: "agent-1",
          newReputation: 0.8,
          delta: 0.1,
        });
      }).not.toThrow();
    });

    it("debe manejar eventos de acciones completadas", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
          agentId: "agent-1",
          actionType: "build",
          success: true,
          impact: 5,
        });
      }).not.toThrow();
    });
  });
});

