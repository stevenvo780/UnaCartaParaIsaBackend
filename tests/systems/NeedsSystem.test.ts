import { describe, it, expect, beforeEach } from "vitest";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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

    // Test eliminado porque EntityNeedsData no tiene propiedad isDead y el sistema maneja la muerte de otra forma
    /*
    it("no debe actualizar necesidades de entidades muertas", () => {
      needsSystem.initializeEntityNeeds("entity-10");
      const needs = needsSystem.getEntityNeeds("entity-10");
      if (needs) {
        needs.isDead = true;
        const initialHunger = needs.needs.hunger;
        
        needsSystem.update(1000);
        
        const updated = needsSystem.getEntityNeeds("entity-10");
        // Si está muerto, no debería cambiar (aunque el sistema actual no verifica esto)
        expect(updated).toBeDefined();
      }
    });
    */
  });
});

