import { describe, it, expect, beforeEach } from "vitest";
import { NormsSystem } from "../../src/simulation/systems/NormsSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

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
      expect(result.violated).toBe(true);
      expect(result.sanction).toBeDefined();
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
      const stats = normsSystem.getComplianceStats();
      expect(stats).toBeDefined();
      expect(stats.totalViolations).toBeDefined();
    });
  });
});

