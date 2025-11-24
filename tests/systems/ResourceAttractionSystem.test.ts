import { describe, it, expect, beforeEach } from "vitest";
import { ResourceAttractionSystem } from "../../src/simulation/systems/ResourceAttractionSystem.js";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ResourceAttractionSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let resourceAttractionSystem: ResourceAttractionSystem;

  beforeEach(() => {
    gameState = createMockGameState();
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
  });

  describe("Snapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = resourceAttractionSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.desires)).toBe(true);
      expect(Array.isArray(snapshot.fields)).toBe(true);
    });
  });
});

