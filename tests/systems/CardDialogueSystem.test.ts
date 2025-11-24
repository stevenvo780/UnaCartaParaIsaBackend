import { describe, it, expect, beforeEach } from "vitest";
import { CardDialogueSystem } from "../../src/domain/simulation/systems/CardDialogueSystem.ts";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("CardDialogueSystem", () => {
  let gameState: GameState;
  let needsSystem: NeedsSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let cardSystem: CardDialogueSystem;

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
    cardSystem = new CardDialogueSystem(gameState, needsSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(cardSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => cardSystem.update(1000)).not.toThrow();
    });

    it("debe generar tarjetas después del intervalo", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      cardSystem.update(31000); // Más del GENERATION_INTERVAL
      const snapshot = cardSystem.getSnapshot();
      expect(snapshot).toBeDefined();
    });
  });

  describe("getSnapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = cardSystem.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.active)).toBe(true);
      expect(Array.isArray(snapshot.history)).toBe(true);
      expect(snapshot.queueSize).toBeDefined();
    });
  });
});
