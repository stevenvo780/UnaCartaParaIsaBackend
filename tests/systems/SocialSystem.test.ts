import { describe, it, expect, beforeEach } from "vitest";
import { SocialSystem } from "../../src/simulation/systems/SocialSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("SocialSystem", () => {
  let gameState: GameState;
  let socialSystem: SocialSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    socialSystem = new SocialSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(socialSystem).toBeDefined();
    });
  });

  describe("Gestión de afinidad", () => {
    it("debe agregar arista entre dos entidades", () => {
      socialSystem.addEdge("entity-1", "entity-2", 0.5);
      const affinity = socialSystem.getAffinityBetween("entity-1", "entity-2");
      expect(affinity).toBe(0.5);
    });

    it("debe retornar afinidad simétrica", () => {
      socialSystem.addEdge("entity-3", "entity-4", 0.3);
      const affinity1 = socialSystem.getAffinityBetween("entity-3", "entity-4");
      const affinity2 = socialSystem.getAffinityBetween("entity-4", "entity-3");
      expect(affinity1).toBe(affinity2);
    });

    it("debe retornar 0 para entidades sin relación", () => {
      const affinity = socialSystem.getAffinityBetween("entity-5", "entity-6");
      expect(affinity).toBe(0);
    });

    it("debe retornar 1 para la misma entidad", () => {
      const affinity = socialSystem.getAffinityBetween("entity-7", "entity-7");
      expect(affinity).toBe(1);
    });

    it("debe limitar afinidad entre -1 y 1", () => {
      socialSystem.addEdge("entity-8", "entity-9", 2.0);
      const affinity = socialSystem.getAffinityBetween("entity-8", "entity-9");
      expect(affinity).toBeLessThanOrEqual(1);
      expect(affinity).toBeGreaterThanOrEqual(-1);
    });

    it("debe acumular cambios de afinidad", () => {
      socialSystem.addEdge("entity-10", "entity-11", 0.3);
      socialSystem.addEdge("entity-10", "entity-11", 0.2);
      const affinity = socialSystem.getAffinityBetween("entity-10", "entity-11");
      expect(affinity).toBe(0.5);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => socialSystem.update(1000)).not.toThrow();
    });

    it("debe degradar afinidad con el tiempo", () => {
      socialSystem.addEdge("entity-12", "entity-13", 0.8);
      const initialAffinity = socialSystem.getAffinityBetween("entity-12", "entity-13");
      
      socialSystem.update(2000);
      
      const updatedAffinity = socialSystem.getAffinityBetween("entity-12", "entity-13");
      expect(updatedAffinity).toBeLessThan(initialAffinity);
    });

    it("no debe degradar afinidad por debajo de 0", () => {
      socialSystem.addEdge("entity-14", "entity-15", 0.1);
      
      // Simular mucho tiempo
      for (let i = 0; i < 100; i++) {
        socialSystem.update(1000);
      }
      
      const affinity = socialSystem.getAffinityBetween("entity-14", "entity-15");
      expect(affinity).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new SocialSystem(gameState, {
        proximityRadius: 200,
        reinforcementPerSecond: 0.1,
        decayPerSecond: 0.02,
        groupThreshold: 0.7,
      });
      expect(customSystem).toBeDefined();
    });
  });
});

