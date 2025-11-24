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
      }
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas de conflictos", () => {
      const stats = conflictSystem.getConflictStats();
      expect(stats).toBeDefined();
      expect(stats.totalConflicts).toBeDefined();
    });
  });
});

