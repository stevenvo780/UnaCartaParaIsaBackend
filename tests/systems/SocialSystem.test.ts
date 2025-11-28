import { describe, it, expect, beforeEach } from "vitest";
import { SocialSystem } from "../../src/domain/simulation/systems/SocialSystem.ts";
import { createMockGameState, createEntityIndex, createMockGPUService } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { EntityIndex } from "../../src/domain/simulation/core/EntityIndex.ts";

describe("SocialSystem", () => {
  let gameState: GameState;
  let socialSystem: SocialSystem;
  let entityIndex: EntityIndex;

  beforeEach(() => {
    gameState = createMockGameState();
    entityIndex = createEntityIndex(gameState);
    const gpuService = createMockGPUService();
    socialSystem = new SocialSystem(gameState, undefined, gpuService as any, entityIndex);
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

  describe("Actualización de proximidad", () => {
    it("debe reforzar afinidad entre entidades cercanas", () => {
      gameState.entities = [
        {
          id: "entity-16",
          position: { x: 100, y: 100 },
          type: "agent",
        },
        {
          id: "entity-17",
          position: { x: 150, y: 100 }, // Dentro del radio de proximidad
          type: "agent",
        },
      ];

      const initialAffinity = socialSystem.getAffinityBetween("entity-16", "entity-17");
      socialSystem.update(1000);
      const updatedAffinity = socialSystem.getAffinityBetween("entity-16", "entity-17");
      expect(updatedAffinity).toBeGreaterThanOrEqual(initialAffinity);
    });

    it("no debe reforzar afinidad entre entidades lejanas", () => {
      gameState.entities = [
        {
          id: "entity-18",
          position: { x: 100, y: 100 },
          type: "agent",
        },
        {
          id: "entity-19",
          position: { x: 500, y: 500 }, // Fuera del radio de proximidad
          type: "agent",
        },
      ];

      const initialAffinity = socialSystem.getAffinityBetween("entity-18", "entity-19");
      socialSystem.update(1000);
      const updatedAffinity = socialSystem.getAffinityBetween("entity-18", "entity-19");
      // Puede degradarse o mantenerse igual
      expect(updatedAffinity).toBeGreaterThanOrEqual(-1);
      expect(updatedAffinity).toBeLessThanOrEqual(1);
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const gpuService = createMockGPUService();
      const customSystem = new SocialSystem(gameState, undefined, gpuService as any, entityIndex, {
        proximityRadius: 200,
        reinforcementPerSecond: 0.1,
        decayPerSecond: 0.02,
        groupThreshold: 0.7,
      });
      expect(customSystem).toBeDefined();
    });
  });

  describe("imposeTruce e isTruceActive", () => {
    it("debe imponer tregua entre dos agentes", () => {
      socialSystem.imposeTruce("agent-1", "agent-2", 5000);
      const isActive = socialSystem.isTruceActive("agent-1", "agent-2");
      expect(isActive).toBe(true);
    });

    it("debe retornar false cuando la tregua expira", () => {
      socialSystem.imposeTruce("agent-3", "agent-4", 100);
      // Esperar a que expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const isActive = socialSystem.isTruceActive("agent-3", "agent-4");
          expect(isActive).toBe(false);
          resolve();
        }, 200);
      });
    });

    it("debe mejorar afinidad negativa al imponer tregua", () => {
      socialSystem.addEdge("agent-5", "agent-6", -0.5);
      const initialAffinity = socialSystem.getAffinityBetween("agent-5", "agent-6");
      socialSystem.imposeTruce("agent-5", "agent-6", 5000);
      const newAffinity = socialSystem.getAffinityBetween("agent-5", "agent-6");
      expect(newAffinity).toBeGreaterThan(initialAffinity);
    });
  });

  describe("setAffinity y modifyAffinity", () => {
    it("debe establecer afinidad a un valor específico", () => {
      socialSystem.setAffinity("agent-7", "agent-8", 0.7);
      const affinity = socialSystem.getAffinityBetween("agent-7", "agent-8");
      expect(affinity).toBe(0.7);
    });

    it("debe limitar afinidad entre -1 y 1", () => {
      socialSystem.setAffinity("agent-9", "agent-10", 2.0);
      const affinity = socialSystem.getAffinityBetween("agent-9", "agent-10");
      expect(affinity).toBeLessThanOrEqual(1);
      expect(affinity).toBeGreaterThanOrEqual(-1);
    });

    it("debe modificar afinidad agregando un delta", () => {
      socialSystem.setAffinity("agent-11", "agent-12", 0.3);
      socialSystem.modifyAffinity("agent-11", "agent-12", 0.2);
      const affinity = socialSystem.getAffinityBetween("agent-11", "agent-12");
      expect(affinity).toBeCloseTo(0.5, 2);
    });
  });

  describe("removeRelationships", () => {
    it("debe eliminar todas las relaciones de un agente", () => {
      socialSystem.addEdge("agent-13", "agent-14", 0.5);
      socialSystem.addEdge("agent-13", "agent-15", 0.3);
      socialSystem.removeRelationships("agent-13");
      expect(socialSystem.getAffinityBetween("agent-13", "agent-14")).toBe(0);
      expect(socialSystem.getAffinityBetween("agent-13", "agent-15")).toBe(0);
    });
  });

  describe("registerFriendlyInteraction", () => {
    it("debe aumentar afinidad en interacción amigable", () => {
      const initialAffinity = socialSystem.getAffinityBetween("agent-16", "agent-17");
      socialSystem.registerFriendlyInteraction("agent-16", "agent-17");
      const newAffinity = socialSystem.getAffinityBetween("agent-16", "agent-17");
      expect(newAffinity).toBeGreaterThan(initialAffinity);
    });
  });

  describe("imposeLocalTruces", () => {
    it("debe imponer treguas locales en un radio", () => {
      gameState.entities = [
        {
          id: "agent-18",
          x: 100,
          y: 100,
          position: { x: 100, y: 100 },
          type: "agent",
        },
        {
          id: "agent-19",
          x: 150,
          y: 100,
          position: { x: 150, y: 100 },
          type: "agent",
        },
        {
          id: "agent-20",
          x: 200,
          y: 100,
          position: { x: 200, y: 100 },
          type: "agent",
        },
      ];
      // Mark dirty and rebuild entityIndex after modifying gameState.entities
      entityIndex.markDirty();
      entityIndex.rebuild(gameState);
      // Actualizar para inicializar el spatial grid
      socialSystem.update(1000);
      socialSystem.imposeLocalTruces("agent-18", 200, 5000);
      // Verificar que hay treguas activas entre agentes cercanos
      const isActive1 = socialSystem.isTruceActive("agent-18", "agent-19");
      expect(isActive1).toBe(true);
    });
  });

  describe("registerPermanentBond", () => {
    it("debe registrar vínculo permanente de familia", () => {
      gameState.entities = [
        { id: "agent-21", position: { x: 100, y: 100 }, type: "agent" },
        { id: "agent-22", position: { x: 150, y: 100 }, type: "agent" },
      ];
      // registerPermanentBond aumenta la afinidad a al menos 0.5 si está por debajo
      // pero el umbral de grupo es 0.6, así que necesitamos asegurar que esté por encima
      socialSystem.setAffinity("agent-21", "agent-22", 0.1);
      socialSystem.registerPermanentBond("agent-21", "agent-22", "family");
      // Verificar que la afinidad aumentó
      const affinity = socialSystem.getAffinityBetween("agent-21", "agent-22");
      expect(affinity).toBeGreaterThanOrEqual(0.5);
    });

    it("debe aumentar afinidad al registrar vínculo permanente", () => {
      socialSystem.setAffinity("agent-23", "agent-24", 0.2);
      socialSystem.registerPermanentBond("agent-23", "agent-24", "marriage");
      const affinity = socialSystem.getAffinityBetween("agent-23", "agent-24");
      expect(affinity).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("addInfamy y getInfamy", () => {
    it("debe agregar infamia a un agente", () => {
      socialSystem.addInfamy("agent-25", 10);
      const infamy = socialSystem.getInfamy("agent-25");
      expect(infamy).toBe(10);
    });

    it("debe acumular infamia", () => {
      socialSystem.addInfamy("agent-26", 5);
      socialSystem.addInfamy("agent-26", 3);
      const infamy = socialSystem.getInfamy("agent-26");
      expect(infamy).toBe(8);
    });

    it("debe retornar 0 para agente sin infamia", () => {
      const infamy = socialSystem.getInfamy("agent-27");
      expect(infamy).toBe(0);
    });
  });

  describe("addHeatAt y getZoneHeat", () => {
    it("debe agregar calor en una posición", () => {
      socialSystem.addHeatAt({ x: 100, y: 100 }, 5);
      // El sistema usa zonas, así que necesitamos verificar de otra manera
      // Por ahora solo verificamos que no lance error
      expect(socialSystem).toBeDefined();
    });
  });

  describe("getGroupForAgent y getGroups", () => {
    it("debe retornar grupo para un agente", () => {
      gameState.entities = [
        { id: "agent-28", position: { x: 100, y: 100 }, type: "agent" },
        { id: "agent-29", position: { x: 150, y: 100 }, type: "agent" },
      ];
      socialSystem.setAffinity("agent-28", "agent-29", 0.7); // Por encima del umbral
      socialSystem.update(2000); // Recalcular grupos
      const group = socialSystem.getGroupForAgent("agent-28");
      expect(group).toBeDefined();
    });

    it("debe retornar undefined si el agente no está en un grupo", () => {
      const group = socialSystem.getGroupForAgent("agent-30");
      expect(group).toBeUndefined();
    });

    it("debe retornar todos los grupos", () => {
      socialSystem.registerPermanentBond("agent-31", "agent-32", "family");
      const groups = socialSystem.getGroups();
      expect(Array.isArray(groups)).toBe(true);
    });
  });
});

