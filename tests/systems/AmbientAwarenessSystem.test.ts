import { describe, it, expect, beforeEach } from "vitest";
import { AmbientAwarenessSystem } from "../../src/simulation/systems/AmbientAwarenessSystem.js";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("AmbientAwarenessSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let ambientAwarenessSystem: AmbientAwarenessSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    ambientAwarenessSystem = new AmbientAwarenessSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(ambientAwarenessSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => ambientAwarenessSystem.update(1000)).not.toThrow();
    });
  });

  describe("Snapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = ambientAwarenessSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.wellbeing).toBeDefined();
      expect(snapshot.ambientState).toBeDefined();
    });
  });
});

