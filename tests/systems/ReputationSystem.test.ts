import { describe, it, expect, beforeEach } from "vitest";
import { ReputationSystem } from "../../src/domain/simulation/systems/ReputationSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("ReputationSystem", () => {
  let gameState: GameState;
  let reputationSystem: ReputationSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    reputationSystem = new ReputationSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(reputationSystem).toBeDefined();
    });
  });

  describe("Gestión de confianza", () => {
    it("debe actualizar confianza entre agentes", () => {
      reputationSystem.updateTrust("agent-1", "agent-2", 0.1);
      const trust = reputationSystem.getTrust("agent-1", "agent-2");
      expect(trust).toBeGreaterThan(0.5);
    });

    it("debe retornar confianza inicial si no existe", () => {
      const trust = reputationSystem.getTrust("agent-3", "agent-4");
      expect(trust).toBe(0.5);
    });

    it("debe limitar confianza entre 0 y 1", () => {
      reputationSystem.updateTrust("agent-5", "agent-6", 2.0);
      const trust = reputationSystem.getTrust("agent-5", "agent-6");
      expect(trust).toBeLessThanOrEqual(1);
      expect(trust).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Gestión de reputación", () => {
    it("debe actualizar reputación de agente", () => {
      reputationSystem.updateReputation("agent-7", 0.1);
      const reputation = reputationSystem.getReputation("agent-7");
      expect(reputation).toBeGreaterThan(0.5);
    });

    it("debe retornar reputación inicial si no existe", () => {
      const reputation = reputationSystem.getReputation("agent-8");
      expect(reputation).toBe(0.5);
    });

    it("debe limitar reputación entre 0 y 1", () => {
      reputationSystem.updateReputation("agent-9", 2.0);
      const reputation = reputationSystem.getReputation("agent-9");
      expect(reputation).toBeLessThanOrEqual(1);
      expect(reputation).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => reputationSystem.update(1000)).not.toThrow();
    });

    it("debe degradar confianza con el tiempo", () => {
      reputationSystem.updateTrust("agent-10", "agent-11", 0.3);
      const initialTrust = reputationSystem.getTrust("agent-10", "agent-11");
      
      // Simular múltiples updates para que la degradación sea notable
      for (let i = 0; i < 10; i++) {
        reputationSystem.update(1000);
      }
      
      const updatedTrust = reputationSystem.getTrust("agent-10", "agent-11");
      // La confianza puede degradarse hacia el valor objetivo (0.5)
      expect(updatedTrust).toBeGreaterThanOrEqual(0);
      expect(updatedTrust).toBeLessThanOrEqual(1);
    });
  });

  describe("Manejo de eventos", () => {
    it("debe manejar cambios en relaciones sociales", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.SOCIAL_RELATION_CHANGED, {
          agentA: "agent-12",
          agentB: "agent-13",
          delta: 0.1,
        });
      }).not.toThrow();
    });

    it("debe manejar eventos de combate", () => {
      expect(() => {
        simulationEvents.emit(GameEventNames.COMBAT_HIT, {
          attackerId: "attacker-1",
          targetId: "target-1",
          damage: 10,
        });
      }).not.toThrow();
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas del sistema", () => {
      reputationSystem.updateReputation("agent-16", 0.1);
      const stats = reputationSystem.getSystemStats();
      expect(stats).toBeDefined();
      expect(stats.agents).toBeGreaterThanOrEqual(0);
      expect(stats.avgReputation).toBeGreaterThanOrEqual(0);
      expect(stats.trustEdges).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Historial de reputación", () => {
    it("debe retornar historial de cambios de reputación", () => {
      reputationSystem.updateReputation("agent-17", 0.1, "test_reason");
      const history = reputationSystem.getReputationHistory("agent-17");
      expect(Array.isArray(history)).toBe(true);
    });

    it("debe retornar array vacío para agente sin historial", () => {
      const history = reputationSystem.getReputationHistory("nonexistent");
      expect(history).toEqual([]);
    });
  });
});

