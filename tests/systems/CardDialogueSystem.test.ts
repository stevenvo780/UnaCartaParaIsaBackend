import { describe, it, expect, beforeEach } from "vitest";
import { CardDialogueSystem } from "../../src/simulation/systems/CardDialogueSystem.js";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("CardDialogueSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let cardDialogueSystem: CardDialogueSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    cardDialogueSystem = new CardDialogueSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(cardDialogueSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => cardDialogueSystem.update(1000)).not.toThrow();
    });
  });

  describe("Snapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = cardDialogueSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.active)).toBe(true);
      expect(Array.isArray(snapshot.history)).toBe(true);
    });
  });
});

