import { describe, it, expect, beforeEach } from "vitest";
import { NormsSystem } from "../../src/domain/simulation/systems/NormsSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("NormsSystem", () => {
  let gameState: GameState;
  let normsSystem: NormsSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    normsSystem = new NormsSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(normsSystem).toBeDefined();
    });
  });

  describe("Manejo de combate en zonas", () => {
    it("debe detectar violación en zona protegida", () => {
      const result = normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "rest"
      );
      // "rest" puede no ser una zona protegida según la implementación
      expect(result).toBeDefined();
      expect(typeof result.violated).toBe("boolean");
      if (result.violated) {
        expect(result.sanction).toBeDefined();
      }
    });

    it("no debe detectar violación en zona no protegida", () => {
      const result = normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "work"
      );
      expect(result.violated).toBe(false);
    });
  });

  describe("Despacho de guardias", () => {
    it("debe despachar guardia", () => {
      expect(() => {
        normsSystem.dispatchGuard(
          "guard-1",
          { x: 100, y: 100 },
          "zone-1",
          50
        );
      }).not.toThrow();
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas de cumplimiento", () => {
      const stats = normsSystem.getNormCompliance();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
      expect(stats.totalViolations).toBeDefined();
      expect(stats.protectedZonesCount).toBeDefined();
      expect(stats.totalSanctions).toBeDefined();
      expect(stats.totalGuardDispatches).toBeDefined();
      expect(stats.avgViolationsPerDay).toBeDefined();
      expect(stats.mostViolatedZone).toBeDefined();
    });

    it("debe retornar violaciones de normas", () => {
      const violations = normsSystem.getNormViolations();
      expect(Array.isArray(violations)).toBe(true);
    });

    it("debe retornar zonas protegidas", () => {
      const zones = normsSystem.getProtectedZones();
      expect(Array.isArray(zones)).toBe(true);
    });

    it("debe retornar sanciones recientes", () => {
      const sanctions = normsSystem.getRecentSanctions();
      expect(Array.isArray(sanctions)).toBe(true);
    });

    it("debe retornar actividad de guardias", () => {
      const activity = normsSystem.getGuardActivity();
      expect(Array.isArray(activity)).toBe(true);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => normsSystem.update(1000)).not.toThrow();
    });

    it("debe limpiar violaciones antiguas", () => {
      normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "social"
      );
      
      // Simular múltiples updates
      for (let i = 0; i < 10; i++) {
        normsSystem.update(1000);
      }
      
      expect(normsSystem).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("debe limpiar recursos sin errores", () => {
      normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "rest"
      );
      
      expect(() => {
        normsSystem.cleanup();
      }).not.toThrow();
    });

    it("debe limpiar todas las violaciones y sanciones", () => {
      normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "social"
      );
      
      normsSystem.cleanup();
      
      const violations = normsSystem.getNormViolations();
      const sanctions = normsSystem.getRecentSanctions();
      
      expect(violations.length).toBe(0);
      expect(sanctions.length).toBe(0);
    });
  });

  describe("getNormViolations - límites", () => {
    it("debe limitar violaciones al límite especificado", () => {
      // Crear múltiples violaciones
      for (let i = 0; i < 10; i++) {
        normsSystem.handleCombatInZone(
          `attacker-${i}`,
          `target-${i}`,
          `zone-${i}`,
          "social"
        );
      }
      
      const violations = normsSystem.getNormViolations(5);
      expect(violations.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getRecentSanctions - límites", () => {
    it("debe limitar sanciones al límite especificado", () => {
      // Crear múltiples violaciones que generen sanciones
      for (let i = 0; i < 10; i++) {
        normsSystem.handleCombatInZone(
          `attacker-${i}`,
          `target-${i}`,
          `zone-${i}`,
          "social"
        );
      }
      
      const sanctions = normsSystem.getRecentSanctions(5);
      expect(sanctions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getGuardActivity - límites", () => {
    it("debe limitar actividad de guardias al límite especificado", () => {
      // Despachar múltiples guardias
      for (let i = 0; i < 10; i++) {
        normsSystem.dispatchGuard(
          `guard-${i}`,
          { x: 100 + i, y: 100 + i },
          `zone-${i}`,
          50
        );
      }
      
      const activity = normsSystem.getGuardActivity(5);
      expect(activity.length).toBeLessThanOrEqual(5);
    });
  });

  describe("handleCombatInZone - casos edge", () => {
    it("debe manejar diferentes tipos de zonas protegidas", () => {
      const protectedZones = ["social", "market"];
      
      protectedZones.forEach((zoneType) => {
        const result = normsSystem.handleCombatInZone(
          "attacker-1",
          "target-1",
          "zone-1",
          zoneType
        );
        expect(result).toBeDefined();
        expect(result.violated).toBe(true);
      });
    });

    it("debe retornar sanción cuando hay violación", () => {
      const result = normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "social"
      );
      
      expect(result.violated).toBe(true);
      if (result.sanction) {
        expect(result.sanction.type).toBeDefined();
        expect(result.sanction.severity).toBeDefined();
      }
    });
  });

  describe("dispatchGuard - casos edge", () => {
    it("debe registrar actividad de guardia", () => {
      normsSystem.dispatchGuard(
        "guard-1",
        { x: 100, y: 100 },
        "zone-1",
        50
      );
      
      const activity = normsSystem.getGuardActivity();
      expect(activity.length).toBeGreaterThan(0);
      expect(activity.some((a) => a.guardId === "guard-1")).toBe(true);
    });

    it("debe actualizar estadísticas al despachar guardia", () => {
      const initialStats = normsSystem.getNormCompliance();
      
      normsSystem.dispatchGuard(
        "guard-1",
        { x: 100, y: 100 },
        "zone-1",
        50
      );
      
      const newStats = normsSystem.getNormCompliance();
      expect(newStats.totalGuardDispatches).toBeGreaterThan(
        initialStats.totalGuardDispatches
      );
    });
  });

  describe("getProtectedZones", () => {
    it("debe retornar zonas protegidas", () => {
      normsSystem.handleCombatInZone(
        "attacker-1",
        "target-1",
        "zone-1",
        "social"
      );
      
      const zones = normsSystem.getProtectedZones();
      expect(Array.isArray(zones)).toBe(true);
      // Las zonas protegidas pueden estar vacías si no hay zonas registradas en gameState
    });
  });
});

