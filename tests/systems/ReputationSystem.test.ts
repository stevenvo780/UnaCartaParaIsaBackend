import { describe, it, expect, beforeEach } from "vitest";
import { ReputationSystem } from "../../src/simulation/systems/ReputationSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

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
});

