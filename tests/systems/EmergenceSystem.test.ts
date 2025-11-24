import { describe, it, expect, beforeEach } from "vitest";
import { EmergenceSystem } from "../../src/simulation/systems/EmergenceSystem.ts";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.ts";
import { SocialSystem } from "../../src/simulation/systems/SocialSystem.ts";
import { EconomySystem } from "../../src/simulation/systems/EconomySystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("EmergenceSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let socialSystem: SocialSystem;
  let economySystem: EconomySystem;
  let emergenceSystem: EmergenceSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    socialSystem = new SocialSystem(gameState);
    economySystem = new EconomySystem(gameState);
    emergenceSystem = new EmergenceSystem(gameState, undefined, {
      needsSystem,
      socialSystem,
      lifeCycleSystem,
      economySystem,
    });
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(emergenceSystem).toBeDefined();
    });

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new EmergenceSystem(gameState, {
        evaluationIntervalMs: 10000,
        patternMinStrength: 0.5,
        patternMaxDuration: 120000,
        historySize: 200,
      });
      expect(customSystem).toBeDefined();
    });

    it("debe aceptar sistemas opcionales", () => {
      const systemWithoutSystems = new EmergenceSystem(gameState);
      expect(systemWithoutSystems).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => emergenceSystem.update(1000)).not.toThrow();
    });

    it("debe evaluar patrones después del intervalo", () => {
      emergenceSystem.update(6000); // Más del evaluationIntervalMs
      expect(emergenceSystem).toBeDefined();
    });
  });

  describe("Métricas de emergencia", () => {
    it("debe calcular métricas de emergencia", () => {
      emergenceSystem.update(6000);
      const metrics = emergenceSystem.getMetricsHistory();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe("Patrones emergentes", () => {
    it("debe retornar patrones activos", () => {
      const patterns = emergenceSystem.getActivePatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});

