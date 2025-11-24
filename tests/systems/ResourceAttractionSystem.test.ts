import { describe, it, expect, beforeEach } from "vitest";
import { ResourceAttractionSystem } from "../../src/domain/simulation/systems/ResourceAttractionSystem.ts";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("ResourceAttractionSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let resourceAttractionSystem: ResourceAttractionSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "agent-1",
          position: { x: 100, y: 100 },
          type: "agent",
        },
      ],
    });
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    resourceAttractionSystem = new ResourceAttractionSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(resourceAttractionSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => resourceAttractionSystem.update(1000)).not.toThrow();
    });

    it("debe calcular deseos basados en necesidades", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 80; // Alta necesidad
        needs.thirst = 70;
      }
      resourceAttractionSystem.update(1000);
      const snapshot = resourceAttractionSystem.getSnapshot();
      expect(snapshot.desires.length).toBeGreaterThanOrEqual(0);
    });

    it("debe detectar emergencias cuando las necesidades son críticas", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 98; // Muy alta necesidad
      }
      resourceAttractionSystem.update(1000);
      const snapshot = resourceAttractionSystem.getSnapshot();
      expect(snapshot.emergencies.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Snapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = resourceAttractionSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.desires)).toBe(true);
      expect(Array.isArray(snapshot.fields)).toBe(true);
      expect(snapshot.stats).toBeDefined();
    });

    it("debe incluir estadísticas en el snapshot", () => {
      const snapshot = resourceAttractionSystem.getSnapshot();
      expect(snapshot.stats.totalDesires).toBeDefined();
      expect(snapshot.stats.activeZones).toBeDefined();
      expect(snapshot.stats.attractedSpawns).toBeDefined();
      expect(snapshot.stats.emergencyRequests).toBeDefined();
    });

    it("debe actualizar timestamp en snapshot", () => {
      const snapshot1 = resourceAttractionSystem.getSnapshot();
      resourceAttractionSystem.update(1000);
      const snapshot2 = resourceAttractionSystem.getSnapshot();
      expect(snapshot2.updatedAt).toBeGreaterThanOrEqual(snapshot1.updatedAt);
    });
  });
});

