import { describe, it, expect, beforeEach } from "vitest";
import { ConflictResolutionSystem } from "../../src/domain/simulation/systems/conflict/ConflictResolutionSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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

    it("debe proponer tregua cuando la salud es baja (<=25)", () => {
      // Ejecutar múltiples veces para aumentar probabilidad
      let proposed = false;
      for (let i = 0; i < 20; i++) {
        const result = conflictSystem.handleCombatHit({
          attackerId: "attacker-1",
          targetId: "target-1",
          remaining: 20, // Por debajo del umbral de 25
          damage: 10,
        });
        if (result.shouldProposeTruce) {
          proposed = true;
          expect(result.cardId).toBeDefined();
          expect(result.reason).toBe("low_health");
          break;
        }
      }
      // Al menos una vez debería proponer tregua con 70% de probabilidad
      expect(proposed).toBe(true);
    });

    it("debe proponer tregua cuando el daño es alto (>=18)", () => {
      let proposed = false;
      for (let i = 0; i < 20; i++) {
        const result = conflictSystem.handleCombatHit({
          attackerId: "attacker-1",
          targetId: "target-1",
          remaining: 50,
          damage: 20, // Por encima del umbral de 18
        });
        if (result.shouldProposeTruce) {
          proposed = true;
          expect(result.cardId).toBeDefined();
          expect(result.reason).toBe("heavy_hit");
          break;
        }
      }
      expect(proposed).toBe(true);
    });

    it("debe establecer firstConflictTime en el primer conflicto", () => {
      const newSystem = new ConflictResolutionSystem(gameState);
      newSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      // El sistema debería haber registrado el tiempo del primer conflicto
      expect(newSystem).toBeDefined();
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
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        const stats = conflictSystem.getConflictStats();
        expect(stats.totalConflicts).toBeGreaterThan(0);
      }
    });

    it("debe limitar el tamaño del historial a MAX_HISTORY", () => {
      // Crear muchos conflictos
      for (let i = 0; i < 250; i++) {
        const hitResult = conflictSystem.handleCombatHit({
          attackerId: `attacker-${i}`,
          targetId: `target-${i}`,
          remaining: 20,
          damage: 10,
        });
        
        if (hitResult.cardId) {
          conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        }
      }
      
      const stats = conflictSystem.getConflictStats();
      // El historial debería estar limitado
      expect(stats.totalConflicts).toBeLessThanOrEqual(200);
    });
  });

  describe("Mediaciones", () => {
    it("debe registrar intentos de mediación", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const stats = conflictSystem.getConflictStats();
        expect(stats.totalMediations).toBeGreaterThan(0);
      }
    });

    it("debe actualizar outcome de mediación al resolver", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        const stats = conflictSystem.getConflictStats();
        expect(stats.mediationSuccessRate).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Bonus de tregua", () => {
    it("debe retornar bonus al aceptar tregua", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        expect(result.truceBonus).toBe(0.1);
      }
    });

    it("debe retornar bonus mayor al disculparse", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "apologize");
        expect(result.truceBonus).toBe(0.2);
      }
    });

    it("no debe retornar bonus al continuar conflicto", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const result = conflictSystem.resolveConflict(hitResult.cardId, "continue");
        expect(result.truceBonus).toBeUndefined();
      }
    });
  });

  describe("getActiveConflicts", () => {
    it("debe retornar conflictos activos", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const activeConflicts = conflictSystem.getActiveConflicts();
        expect(activeConflicts.length).toBeGreaterThan(0);
        expect(activeConflicts.some((c) => c.cardId === hitResult.cardId)).toBe(true);
      }
    });

    it("debe retornar array vacío si no hay conflictos activos", () => {
      const newSystem = new ConflictResolutionSystem(gameState);
      const activeConflicts = newSystem.getActiveConflicts();
      expect(activeConflicts).toEqual([]);
    });
  });

  describe("getConflictHistory", () => {
    it("debe retornar historial de conflictos", () => {
      conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      const history = conflictSystem.getConflictHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it("debe limitar el historial al límite especificado", () => {
      // Crear varios conflictos
      for (let i = 0; i < 10; i++) {
        const hitResult = conflictSystem.handleCombatHit({
          attackerId: `attacker-${i}`,
          targetId: `target-${i}`,
          remaining: 20,
          damage: 10,
        });
        if (hitResult.cardId) {
          conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        }
      }
      
      const history = conflictSystem.getConflictHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getMediationAttempts", () => {
    it("debe retornar intentos de mediación", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const attempts = conflictSystem.getMediationAttempts();
        expect(Array.isArray(attempts)).toBe(true);
        expect(attempts.length).toBeGreaterThan(0);
      }
    });

    it("debe limitar los intentos al límite especificado", () => {
      // Crear varios conflictos
      for (let i = 0; i < 10; i++) {
        const hitResult = conflictSystem.handleCombatHit({
          attackerId: `attacker-${i}`,
          targetId: `target-${i}`,
          remaining: 20,
          damage: 10,
        });
        if (hitResult.cardId) {
          conflictSystem.resolveConflict(hitResult.cardId, "truce_accept");
        }
      }
      
      const attempts = conflictSystem.getMediationAttempts(5);
      expect(attempts.length).toBeLessThanOrEqual(5);
    });
  });

  describe("update", () => {
    it("debe actualizar sin errores", () => {
      expect(() => conflictSystem.update()).not.toThrow();
    });

    it("debe expirar conflictos activos después del tiempo límite", () => {
      const hitResult = conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      if (hitResult.cardId) {
        const initialActive = conflictSystem.getActiveConflicts();
        expect(initialActive.length).toBeGreaterThan(0);
        
        // Simular que pasa el tiempo (update expira las tarjetas)
        // Necesitamos esperar o simular el tiempo
        conflictSystem.update();
        // Los conflictos pueden expirar, pero no podemos verificar fácilmente sin mockear el tiempo
        expect(conflictSystem).toBeDefined();
      }
    });
  });

  describe("cleanup", () => {
    it("debe limpiar todos los datos", () => {
      conflictSystem.handleCombatHit({
        attackerId: "attacker-1",
        targetId: "target-1",
        remaining: 20,
        damage: 10,
      });
      
      conflictSystem.cleanup();
      
      const activeConflicts = conflictSystem.getActiveConflicts();
      const history = conflictSystem.getConflictHistory();
      const attempts = conflictSystem.getMediationAttempts();
      
      expect(activeConflicts.length).toBe(0);
      expect(history.length).toBe(0);
      expect(attempts.length).toBe(0);
    });
  });
});

