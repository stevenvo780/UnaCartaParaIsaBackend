import { describe, it, expect, beforeEach } from "vitest";
import { AmbientAwarenessSystem } from "../../src/domain/simulation/systems/agents/AmbientAwarenessSystem.ts";
import { NeedsSystem } from "../../src/domain/simulation/systems/agents/needs/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("AmbientAwarenessSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let ambientSystem: AmbientAwarenessSystem;

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
    ambientSystem = new AmbientAwarenessSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(ambientSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => ambientSystem.update(1000)).not.toThrow();
    });

    it("debe calcular wellbeing basado en necesidades", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      ambientSystem.update(1000);
      const snapshot = ambientSystem.getSnapshot();
      expect(snapshot.wellbeing).toBeDefined();
      expect(snapshot.wellbeing.average).toBeGreaterThanOrEqual(0);
    });

    it("debe calcular estado ambiental basado en wellbeing", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      ambientSystem.update(1000);
      const snapshot = ambientSystem.getSnapshot();
      expect(snapshot.ambientState).toBeDefined();
      expect(snapshot.ambientState.musicMood).toBeDefined();
    });
  });

  describe("getSnapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = ambientSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.wellbeing).toBeDefined();
      expect(snapshot.ambientState).toBeDefined();
      expect(snapshot.lastUpdated).toBeDefined();
    });

    it("debe actualizar timestamp en snapshot", () => {
      const snapshot1 = ambientSystem.getSnapshot();
      ambientSystem.update(1000);
      const snapshot2 = ambientSystem.getSnapshot();
      expect(snapshot2.lastUpdated).toBeGreaterThanOrEqual(snapshot1.lastUpdated);
    });
  });
});
