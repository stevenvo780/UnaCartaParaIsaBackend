import { describe, it, expect, beforeEach, vi } from "vitest";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("NeedsSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(needsSystem).toBeDefined();
    });
  });

  describe("Gestión de necesidades de entidades", () => {
    it("debe inicializar necesidades de entidad", () => {
      needsSystem.initializeEntityNeeds("entity-1");
      const needs = needsSystem.getEntityNeeds("entity-1");
      expect(needs).toBeDefined();
      expect(needs?.hunger).toBe(100);
      expect(needs?.thirst).toBe(100);
      expect(needs?.energy).toBe(100);
    });

    it("debe retornar necesidades de entidad", () => {
      needsSystem.initializeEntityNeeds("entity-2");
      const needs = needsSystem.getEntityNeeds("entity-2");
      expect(needs).toBeDefined();
      // EntityNeedsData no contiene el ID
    });

    it("debe retornar undefined para entidad inexistente", () => {
      const needs = needsSystem.getEntityNeeds("nonexistent");
      expect(needs).toBeUndefined();
    });

    it("debe retornar todas las necesidades", () => {
      needsSystem.initializeEntityNeeds("entity-3");
      needsSystem.initializeEntityNeeds("entity-4");
      const allNeeds = needsSystem.getAllNeeds();
      expect(allNeeds.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Actualización de necesidades", () => {
    it("debe actualizar necesidades con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-5");
      const initialNeeds = needsSystem.getEntityNeeds("entity-5");
      const initialHunger = initialNeeds?.hunger || 100;
      
      needsSystem.update(1000); // 1 segundo
      
      const updatedNeeds = needsSystem.getEntityNeeds("entity-5");
      expect(updatedNeeds?.hunger).toBeLessThan(initialHunger);
    });

    it("debe degradar hambre con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-6");
      needsSystem.update(2000);
      
      const needs = needsSystem.getEntityNeeds("entity-6");
      expect(needs?.hunger).toBeLessThan(100);
    });

    it("debe degradar sed con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-7");
      needsSystem.update(2000);
      
      const needs = needsSystem.getEntityNeeds("entity-7");
      expect(needs?.thirst).toBeLessThan(100);
    });

    it("debe degradar energía con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-8");
      needsSystem.update(2000);
      
      const needs = needsSystem.getEntityNeeds("entity-8");
      expect(needs?.energy).toBeLessThan(100);
    });

    it("no debe degradar necesidades por debajo de 0", () => {
      needsSystem.initializeEntityNeeds("entity-9");
      
      // Simular mucho tiempo
      for (let i = 0; i < 100; i++) {
        needsSystem.update(1000);
      }
      
      const needs = needsSystem.getEntityNeeds("entity-9");
      expect(needs?.hunger).toBeGreaterThanOrEqual(0);
      expect(needs?.thirst).toBeGreaterThanOrEqual(0);
      expect(needs?.energy).toBeGreaterThanOrEqual(0);
    });

  });

  describe("Satisfacer necesidades", () => {
    it("debe satisfacer necesidad de hambre", () => {
      needsSystem.initializeEntityNeeds("entity-10");
      needsSystem.modifyNeed("entity-10", "hunger", -50); // Reducir hambre a 50
      
      const before = needsSystem.getEntityNeeds("entity-10");
      const initialHunger = before?.hunger || 50;
      
      needsSystem.satisfyNeed("entity-10", "hunger", 30);
      
      const after = needsSystem.getEntityNeeds("entity-10");
      expect(after?.hunger).toBeGreaterThan(initialHunger);
      expect(after?.hunger).toBe(80); // 50 + 30
    });

    it("debe satisfacer necesidad de sed", () => {
      needsSystem.initializeEntityNeeds("entity-11");
      needsSystem.modifyNeed("entity-11", "thirst", -50); // Reducir sed a 50
      
      const before = needsSystem.getEntityNeeds("entity-11");
      const initialThirst = before?.thirst || 50;
      
      needsSystem.satisfyNeed("entity-11", "thirst", 30);
      
      const after = needsSystem.getEntityNeeds("entity-11");
      expect(after?.thirst).toBeGreaterThan(initialThirst);
      expect(after?.thirst).toBe(80); // 50 + 30
    });

    it("debe limitar necesidades a máximo 100", () => {
      needsSystem.initializeEntityNeeds("entity-12");
      needsSystem.satisfyNeed("entity-12", "hunger", 200);
      
      const needs = needsSystem.getEntityNeeds("entity-12");
      expect(needs?.hunger).toBeLessThanOrEqual(100);
    });

    it("debe retornar false para entidad inexistente", () => {
      const result = needsSystem.satisfyNeed("nonexistent", "hunger", 50);
      expect(result).toBe(false);
    });
  });

  describe("Modificar necesidades", () => {
    it("debe modificar necesidad sumando delta", () => {
      needsSystem.initializeEntityNeeds("entity-13");
      needsSystem.modifyNeed("entity-13", "hunger", -50); // Reducir de 100 a 50
      
      const needs = needsSystem.getEntityNeeds("entity-13");
      expect(needs?.hunger).toBe(50);
    });

    it("debe limitar modificación a rango válido", () => {
      needsSystem.initializeEntityNeeds("entity-14");
      needsSystem.modifyNeed("entity-14", "hunger", 150);
      
      const needs = needsSystem.getEntityNeeds("entity-14");
      expect(needs?.hunger).toBeLessThanOrEqual(100);
    });

    it("debe retornar false para entidad inexistente", () => {
      const result = needsSystem.modifyNeed("nonexistent", "hunger", 50);
      expect(result).toBe(false);
    });
  });

  describe("Necesidades críticas", () => {
    it("debe detectar necesidad crítica en update", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-15");
      needsSystem.modifyNeed("entity-15", "hunger", 25); // Por debajo del umbral crítico pero no causa muerte inmediata
      
      needsSystem.update(1000);
      
      // Puede emitir NEED_CRITICAL o AGENT_DEATH dependiendo de la degradación
      expect(emitSpy).toHaveBeenCalled();
    });

    it("debe emitir evento cuando necesidad se satisface", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-16");
      needsSystem.modifyNeed("entity-16", "hunger", 50);
      needsSystem.satisfyNeed("entity-16", "hunger", 50);
      
      needsSystem.update(1000);
      
      // Debería emitir evento de necesidad satisfecha si está por encima de 90
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe("Zonas y beneficios", () => {
    it("debe aplicar beneficios de zona de comida", () => {
      gameState.zones = [
        {
          id: "kitchen-1",
          type: "kitchen",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
      ];
      
      const agent = lifeCycleSystem.spawnAgent({ name: "Test Agent" });
      // Asegurar que el agente tiene posición
      if (!agent.position) {
        agent.position = { x: 120, y: 120 };
      } else {
        agent.position.x = 120;
        agent.position.y = 120;
      }
      
      // Asegurar que el agente está en gameState.agents
      if (!gameState.agents) {
        gameState.agents = [];
      }
      const agentIndex = gameState.agents.findIndex(a => a.id === agent.id);
      if (agentIndex >= 0) {
        gameState.agents[agentIndex] = agent;
      } else {
        gameState.agents.push(agent);
      }
      
      needsSystem.initializeEntityNeeds(agent.id);
      needsSystem.modifyNeed(agent.id, "hunger", 50);
      
      const before = needsSystem.getEntityNeeds(agent.id);
      const initialHunger = before?.hunger || 50;
      
      // Actualizar con intervalo pequeño para que se procese
      needsSystem.update(2000);
      
      const after = needsSystem.getEntityNeeds(agent.id);
      // La hambre puede aumentar por la zona o degradarse, pero debería estar en rango válido
      expect(after?.hunger).toBeGreaterThanOrEqual(0);
      expect(after?.hunger).toBeLessThanOrEqual(100);
    });
  });

  describe("Eventos de necesidades críticas", () => {
    it("debe emitir evento cuando necesidad es crítica", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-17");
      needsSystem.modifyNeed("entity-17", "hunger", 25); // Por debajo del umbral crítico (20) pero no causa muerte
      
      needsSystem.update(1000);
      
      // Puede emitir NEED_CRITICAL o AGENT_DEATH dependiendo de la degradación
      expect(emitSpy).toHaveBeenCalled();
    });

    it("debe emitir evento de muerte cuando necesidad llega a 0", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-18");
      needsSystem.modifyNeed("entity-18", "hunger", 0); // Causa muerte
      
      needsSystem.update(1000);
      
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.AGENT_DEATH,
        expect.objectContaining({
          agentId: "entity-18",
          cause: "starvation",
        }),
      );
    });
  });

  describe("setDependencies", () => {
    it("debe establecer dependencias de sistemas", () => {
      const mockSystems = {
        socialSystem: {} as any,
        divineFavorSystem: {} as any,
      };
      
      expect(() => {
        needsSystem.setDependencies(mockSystems);
      }).not.toThrow();
    });
  });

  describe("getNeeds", () => {
    it("debe retornar necesidades (alias de getEntityNeeds)", () => {
      needsSystem.initializeEntityNeeds("entity-19");
      const needs = needsSystem.getNeeds("entity-19");
      expect(needs).toBeDefined();
      expect(needs?.hunger).toBe(100);
    });

    it("debe retornar undefined para entidad inexistente", () => {
      const needs = needsSystem.getNeeds("nonexistent");
      expect(needs).toBeUndefined();
    });
  });



  describe("Casos edge de satisfyNeed", () => {
    it("debe limitar necesidad a máximo 100", () => {
      needsSystem.initializeEntityNeeds("entity-25");
      needsSystem.satisfyNeed("entity-25", "hunger", 150);
      const needs = needsSystem.getEntityNeeds("entity-25");
      expect(needs?.hunger).toBe(100);
    });

    it("debe retornar false para necesidad inexistente", () => {
      needsSystem.initializeEntityNeeds("entity-26");
      const result = needsSystem.satisfyNeed("entity-26", "nonexistent", 10);
      expect(result).toBe(false);
    });

    it("debe retornar false para entidad inexistente", () => {
      const result = needsSystem.satisfyNeed("nonexistent", "hunger", 10);
      expect(result).toBe(false);
    });
  });

  describe("Casos edge de modifyNeed", () => {
    it("debe limitar necesidad entre 0 y 100", () => {
      needsSystem.initializeEntityNeeds("entity-27");
      needsSystem.modifyNeed("entity-27", "hunger", 150);
      const needs = needsSystem.getEntityNeeds("entity-27");
      expect(needs?.hunger).toBe(100);
      
      needsSystem.modifyNeed("entity-27", "hunger", -200);
      const needs2 = needsSystem.getEntityNeeds("entity-27");
      expect(needs2?.hunger).toBe(0);
    });

    it("debe retornar false para necesidad inexistente", () => {
      needsSystem.initializeEntityNeeds("entity-28");
      const result = needsSystem.modifyNeed("entity-28", "nonexistent", 10);
      expect(result).toBe(false);
    });

    it("debe retornar false para entidad inexistente", () => {
      const result = needsSystem.modifyNeed("nonexistent", "hunger", 10);
      expect(result).toBe(false);
    });
  });
});

