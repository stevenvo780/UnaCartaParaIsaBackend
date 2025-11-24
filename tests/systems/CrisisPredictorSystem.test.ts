import { describe, it, expect, beforeEach } from "vitest";
import { CrisisPredictorSystem } from "../../src/simulation/systems/CrisisPredictorSystem.ts";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("CrisisPredictorSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let crisisPredictorSystem: CrisisPredictorSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    crisisPredictorSystem = new CrisisPredictorSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(crisisPredictorSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => crisisPredictorSystem.update(1000)).not.toThrow();
    });
  });

  describe("Snapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = crisisPredictorSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.indicators)).toBe(true);
      expect(Array.isArray(snapshot.predictions)).toBe(true);
    });
  });
});

