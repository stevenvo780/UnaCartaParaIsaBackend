import { describe, it, expect, beforeEach } from "vitest";
import { EmergenceSystem } from "../../src/simulation/systems/EmergenceSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("EmergenceSystem", () => {
  let gameState: GameState;
  let emergenceSystem: EmergenceSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "entity-1",
          position: { x: 100, y: 100 },
          type: "agent",
        },
        {
          id: "entity-2",
          position: { x: 150, y: 150 },
          type: "agent",
        },
        {
          id: "entity-3",
          position: { x: 200, y: 200 },
          type: "agent",
        },
      ],
      resonance: 0.5,
    });
    emergenceSystem = new EmergenceSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(emergenceSystem).toBeDefined();
    });

    it("debe tener métricas iniciales", () => {
      const metrics = emergenceSystem.getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.cohesion).toBeDefined();
      expect(metrics.novelty).toBeDefined();
      expect(metrics.stability).toBeDefined();
      expect(metrics.complexity).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar correctamente", () => {
      emergenceSystem.update(5000);
      const metrics = emergenceSystem.getSystemMetrics();
      expect(metrics).toBeDefined();
    });

    it("debe evaluar patrones periódicamente", () => {
      emergenceSystem.update(1000);
      emergenceSystem.update(5000);
      const patterns = emergenceSystem.getActivePatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("Gestión de patrones", () => {
    it("debe detectar patrones emergentes", () => {
      emergenceSystem.update(5000);
      const patterns = emergenceSystem.getActivePatterns();
      expect(patterns).toBeDefined();
    });

    it("debe limpiar patrones expirados", () => {
      emergenceSystem.update(5000);
      emergenceSystem.update(70000);
      const patterns = emergenceSystem.getActivePatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it("debe permitir forzar evaluación de patrones", () => {
      emergenceSystem.forcePatternEvaluation();
      const patterns = emergenceSystem.getActivePatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("Métricas", () => {
    it("debe calcular métricas de emergencia", () => {
      emergenceSystem.update(5000);
      const metrics = emergenceSystem.getSystemMetrics();
      expect(metrics.cohesion).toBeGreaterThanOrEqual(0);
      expect(metrics.cohesion).toBeLessThanOrEqual(1);
      expect(metrics.novelty).toBeGreaterThanOrEqual(0);
      expect(metrics.novelty).toBeLessThanOrEqual(1);
      expect(metrics.stability).toBeGreaterThanOrEqual(0);
      expect(metrics.stability).toBeLessThanOrEqual(1);
    });

    it("debe mantener historial de métricas", () => {
      emergenceSystem.update(5000);
      emergenceSystem.update(10000);
      const history = emergenceSystem.getMetricsHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it("debe retornar estadísticas del sistema", () => {
      const stats = emergenceSystem.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalPatterns).toBeDefined();
      expect(stats.activeFeedbackLoops).toBeDefined();
    });

    it("debe retornar estadísticas completas del sistema", () => {
      const systemStats = emergenceSystem.getSystemStats();
      expect(systemStats).toBeDefined();
      expect(systemStats.metrics).toBeDefined();
      expect(systemStats.stats).toBeDefined();
    });
  });

  describe("Bucles de retroalimentación", () => {
    it("debe gestionar bucles de retroalimentación", () => {
      emergenceSystem.update(5000);
      const loops = emergenceSystem.getActiveFeedbackLoops();
      expect(Array.isArray(loops)).toBe(true);
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new EmergenceSystem(gameState, {
        evaluationIntervalMs: 2000,
        patternMinStrength: 0.5,
        patternMaxDuration: 30000,
        historySize: 50,
      });
      expect(customSystem).toBeDefined();
    });
  });
});

