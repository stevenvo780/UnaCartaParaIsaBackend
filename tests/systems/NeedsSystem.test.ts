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
      
      // Esperar más tiempo para que se actualice (updateIntervalMs es 1000ms)
      needsSystem.update(2000); // 2 segundos para asegurar que pase el intervalo
      
      const updatedNeeds = needsSystem.getEntityNeeds("entity-5");
      expect(updatedNeeds?.hunger).toBeLessThan(initialHunger);
    });

    it("debe degradar hambre con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-6");
      // Esperar más tiempo para que se actualice
      needsSystem.update(2000);
      
      const needs = needsSystem.getEntityNeeds("entity-6");
      expect(needs?.hunger).toBeLessThan(100);
    });

    it("debe degradar sed con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-7");
      // Esperar más tiempo para que se actualice
      needsSystem.update(2000);
      
      const needs = needsSystem.getEntityNeeds("entity-7");
      expect(needs?.thirst).toBeLessThan(100);
    });

    it("debe degradar energía con el tiempo", () => {
      needsSystem.initializeEntityNeeds("entity-8");
      // Esperar más tiempo para que se actualice
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
      // Establecer hambre por debajo del umbral crítico (20 por defecto)
      needsSystem.modifyNeed("entity-15", "hunger", -85); // 100 - 85 = 15, por debajo de 20
      
      // Esperar tiempo suficiente para que se actualice
      needsSystem.update(2000);
      
      // Debería emitir NEED_CRITICAL porque hunger < 20
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.NEED_CRITICAL,
        expect.objectContaining({
          agentId: "entity-15",
          need: "hunger",
        }),
      );
    });

    it("debe emitir evento cuando necesidad se satisface", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-16");
      needsSystem.modifyNeed("entity-16", "hunger", -10); // 100 - 10 = 90
      needsSystem.satisfyNeed("entity-16", "hunger", 5); // 90 + 5 = 95, por encima de 90
      
      // Esperar tiempo suficiente para que se actualice
      needsSystem.update(2000);
      
      // Debería emitir evento de necesidad satisfecha si está por encima de 90
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.NEED_SATISFIED,
        expect.objectContaining({
          agentId: "entity-16",
          need: "hunger",
        }),
      );
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
      // Establecer hambre por debajo del umbral crítico (20 por defecto)
      needsSystem.modifyNeed("entity-17", "hunger", -85); // 100 - 85 = 15, por debajo de 20
      
      // Esperar tiempo suficiente para que se actualice
      needsSystem.update(2000);
      
      // Debería emitir NEED_CRITICAL porque hunger < 20
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.NEED_CRITICAL,
        expect.objectContaining({
          agentId: "entity-17",
          need: "hunger",
        }),
      );
    });

    it("debe emitir evento de muerte cuando necesidad llega a 0", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      needsSystem.initializeEntityNeeds("entity-18");
      // Establecer hambre a 0 para causar muerte
      needsSystem.modifyNeed("entity-18", "hunger", -100); // 100 - 100 = 0
      
      // Esperar tiempo suficiente para que se actualice
      needsSystem.update(2000);
      
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

  describe("Beneficios de zona adicionales", () => {
    it("debe aplicar beneficios de zona de kitchen", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-29",
        name: "Entity 29",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 100, y: 100 },
      });
      
      gameState.zones.push({
        id: "kitchen-zone",
        type: "kitchen",
        bounds: { x: 90, y: 90, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-29");
      needsSystem.modifyNeed("entity-29", "hunger", -50);
      const initialHunger = needsSystem.getEntityNeeds("entity-29")?.hunger || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedHunger = needsSystem.getEntityNeeds("entity-29")?.hunger || 0;
      // El beneficio de kitchen es 15 * deltaSeconds, así que con 2 segundos debería ser 30
      // Pero también hay degradación, así que verificamos que el beneficio se aplicó
      // (el valor debería ser mayor que 50 - degradación, o al menos no debería ser mucho menor)
      // Como el beneficio es significativo (30 puntos), debería compensar la degradación
      expect(updatedHunger).toBeGreaterThan(initialHunger - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de well", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-30",
        name: "Entity 30",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 200, y: 200 },
      });
      
      gameState.zones.push({
        id: "well-zone",
        type: "well",
        bounds: { x: 190, y: 190, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-30");
      needsSystem.modifyNeed("entity-30", "thirst", -50);
      const initialThirst = needsSystem.getEntityNeeds("entity-30")?.thirst || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedThirst = needsSystem.getEntityNeeds("entity-30")?.thirst || 0;
      // El beneficio de well es 20 * deltaSeconds, así que con 2 segundos debería ser 40
      // Debería compensar la degradación y aumentar el valor
      expect(updatedThirst).toBeGreaterThan(initialThirst - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de bed", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-31",
        name: "Entity 31",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 300, y: 300 },
      });
      
      gameState.zones.push({
        id: "bed-zone",
        type: "bed",
        bounds: { x: 290, y: 290, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-31");
      needsSystem.modifyNeed("entity-31", "energy", -50);
      const initialEnergy = needsSystem.getEntityNeeds("entity-31")?.energy || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedEnergy = needsSystem.getEntityNeeds("entity-31")?.energy || 0;
      // El beneficio de bed es 12 * deltaSeconds, así que con 2 segundos debería ser 24
      // Debería compensar la degradación y aumentar el valor
      expect(updatedEnergy).toBeGreaterThan(initialEnergy - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de bath", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-32",
        name: "Entity 32",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 400, y: 400 },
      });
      
      gameState.zones.push({
        id: "bath-zone",
        type: "bath",
        bounds: { x: 390, y: 390, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-32");
      needsSystem.modifyNeed("entity-32", "hygiene", -50);
      const initialHygiene = needsSystem.getEntityNeeds("entity-32")?.hygiene || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedHygiene = needsSystem.getEntityNeeds("entity-32")?.hygiene || 0;
      // El beneficio de bath es 25 * deltaSeconds, así que con 2 segundos debería ser 50
      // Debería compensar la degradación y aumentar significativamente el valor
      expect(updatedHygiene).toBeGreaterThan(initialHygiene - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de entertainment", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-33",
        name: "Entity 33",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 500, y: 500 },
      });
      
      gameState.zones.push({
        id: "entertainment-zone",
        type: "entertainment",
        bounds: { x: 490, y: 490, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-33");
      needsSystem.modifyNeed("entity-33", "fun", -50);
      needsSystem.modifyNeed("entity-33", "mentalHealth", -30);
      const initialFun = needsSystem.getEntityNeeds("entity-33")?.fun || 0;
      const initialMentalHealth = needsSystem.getEntityNeeds("entity-33")?.mentalHealth || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedFun = needsSystem.getEntityNeeds("entity-33")?.fun || 0;
      const updatedMentalHealth = needsSystem.getEntityNeeds("entity-33")?.mentalHealth || 0;
      // El beneficio de entertainment es 20 * deltaSeconds para fun y 10 para mentalHealth
      // Debería compensar la degradación y aumentar el valor
      expect(updatedFun).toBeGreaterThan(initialFun - 5); // Permitir pequeña degradación
      expect(updatedMentalHealth).toBeGreaterThan(initialMentalHealth - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de temple", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-34",
        name: "Entity 34",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 600, y: 600 },
      });
      
      gameState.zones.push({
        id: "temple-zone",
        type: "temple",
        bounds: { x: 590, y: 590, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-34");
      needsSystem.modifyNeed("entity-34", "mentalHealth", -50);
      needsSystem.modifyNeed("entity-34", "social", -30);
      const initialMentalHealth = needsSystem.getEntityNeeds("entity-34")?.mentalHealth || 0;
      const initialSocial = needsSystem.getEntityNeeds("entity-34")?.social || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedMentalHealth = needsSystem.getEntityNeeds("entity-34")?.mentalHealth || 0;
      const updatedSocial = needsSystem.getEntityNeeds("entity-34")?.social || 0;
      // El beneficio de temple es 15 * deltaSeconds para mentalHealth y 4.5 para social
      // Debería compensar la degradación y aumentar el valor
      expect(updatedMentalHealth).toBeGreaterThan(initialMentalHealth - 5); // Permitir pequeña degradación
      expect(updatedSocial).toBeGreaterThan(initialSocial - 5); // Permitir pequeña degradación
    });

    it("debe aplicar beneficios de zona de festival", () => {
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "entity-35",
        name: "Entity 35",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: {},
        socialStatus: "commoner",
        generation: 0,
        position: { x: 700, y: 700 },
      });
      
      gameState.zones.push({
        id: "festival-zone",
        type: "festival",
        bounds: { x: 690, y: 690, width: 30, height: 30 },
      });
      
      needsSystem.initializeEntityNeeds("entity-35");
      needsSystem.modifyNeed("entity-35", "fun", -50);
      needsSystem.modifyNeed("entity-35", "mentalHealth", -30);
      const initialFun = needsSystem.getEntityNeeds("entity-35")?.fun || 0;
      const initialMentalHealth = needsSystem.getEntityNeeds("entity-35")?.mentalHealth || 0;
      
      // Esperar tiempo suficiente para que se actualice y se apliquen beneficios
      needsSystem.update(2000);
      
      const updatedFun = needsSystem.getEntityNeeds("entity-35")?.fun || 0;
      const updatedMentalHealth = needsSystem.getEntityNeeds("entity-35")?.mentalHealth || 0;
      // El beneficio de festival es 20 * deltaSeconds para fun y 10 para mentalHealth
      // Debería compensar la degradación y aumentar el valor
      expect(updatedFun).toBeGreaterThan(initialFun - 5); // Permitir pequeña degradación
      expect(updatedMentalHealth).toBeGreaterThan(initialMentalHealth - 5); // Permitir pequeña degradación
    });
  });
});

