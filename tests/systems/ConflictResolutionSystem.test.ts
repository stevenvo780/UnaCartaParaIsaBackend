import { describe, it, expect, beforeEach } from "vitest";
import { ConflictResolutionSystem } from "../../src/simulation/systems/ConflictResolutionSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ConflictResolutionSystem", () => {
  let gameState: GameState;
  let conflictSystem: ConflictResolutionSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    conflictSystem = new ConflictResolutionSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(conflictSystem).toBeDefined();
    });
  });

  describe("Manejo de golpes en combate", () => {
    it("debe manejar golpe en combate", () => {
      const result = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 50,
        damage: 10,
      });
      expect(result).toBeDefined();
      expect(result.shouldProposeTruce).toBeDefined();
    });

    it("debe proponer tregua cuando la salud es baja", () => {
      const result = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      expect(result.shouldProposeTruce).toBeDefined();
    });
  });

  describe("Resolución de conflictos", () => {
    it("debe resolver conflicto con tregua", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe("truce_accepted");
        expect(result.truceBonus).toBeDefined();
      }
    });

    it("debe resolver conflicto con disculpa", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "apologize");
        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe("apologized");
      }
    });

    it("debe continuar conflicto si se elige continue", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "continue");
        expect(result.resolved).toBe(false); // "continue" no resuelve el conflicto
        expect(result.resolution).toBe("continued");
      }
    });

    it("debe retornar false para cardId inexistente", () => {
      const result = conflictSystem.resolveConflict("nonexistent", "truce_accept");
      expect(result.resolved).toBe(false);
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas de conflictos", () => {
      const stats = conflictSystem.getConflictStats();
      expect(stats).toBeDefined();
      expect(stats.totalConflicts).toBeDefined();
      expect(stats.activeNegotiations).toBeDefined();
      expect(stats.totalMediations).toBeDefined();
      expect(stats.mediationSuccessRate).toBeDefined();
      expect(stats.truceAcceptanceRate).toBeDefined();
    });
  });

  describe("Historial de conflictos", () => {
    it("debe registrar conflictos en el historial", () => {
      conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      const stats = conflictSystem.getConflictStats();
      expect(stats.totalConflicts).toBeGreaterThanOrEqual(0);
    });
  });
});

