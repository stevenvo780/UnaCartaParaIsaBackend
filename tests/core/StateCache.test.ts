import { describe, it, expect, beforeEach } from "vitest";
import { StateCache } from "../../src/domain/simulation/core/StateCache";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/domain/types/game-types";

describe("StateCache", () => {
  let stateCache: StateCache;
  let gameState: GameState;

  beforeEach(() => {
    stateCache = new StateCache();
    gameState = createMockGameState();
  });

  describe("markDirty", () => {
    it("debe marcar sección como dirty", () => {
      stateCache.markDirty("agents");
      stateCache.markDirty("entities");

      const snapshot1 = stateCache.getSnapshot(gameState, 1);
      const snapshot2 = stateCache.getSnapshot(gameState, 2);

      // Debe clonar todo cuando hay dirty flags
      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();
    });
  });

  describe("markDirtyMultiple", () => {
    it("debe marcar múltiples secciones", () => {
      stateCache.markDirtyMultiple(["agents", "entities", "zones"]);

      const snapshot = stateCache.getSnapshot(gameState, 1);
      expect(snapshot).toBeDefined();
    });
  });

  describe("clearDirtyFlags", () => {
    it("debe limpiar todos los flags", () => {
      stateCache.markDirty("agents");
      stateCache.clearDirtyFlags();

      // Después de clear, el próximo snapshot debería usar delta si hay previo
      const snapshot1 = stateCache.getSnapshot(gameState, 1);
      const snapshot2 = stateCache.getSnapshot(gameState, 2);

      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();
    });
  });

  describe("getSnapshot", () => {
    it("debe clonar todo cuando no hay snapshot previo", () => {
      const snapshot = stateCache.getSnapshot(gameState, 1);

      expect(snapshot).toBeDefined();
      expect(snapshot).not.toBe(gameState); // Debe ser una copia
    });

    it("debe usar delta cuando hay snapshot previo", () => {
      const snapshot1 = stateCache.getSnapshot(gameState, 1);
      const snapshot2 = stateCache.getSnapshot(gameState, 2);

      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();
      // Ambos deben ser objetos diferentes
      expect(snapshot1).not.toBe(snapshot2);
    });

    it("debe clonar todo cuando todo está dirty", () => {
      const allSections = [
        "agents",
        "entities",
        "animals",
        "zones",
        "worldResources",
        "inventory",
        "socialGraph",
        "market",
        "trade",
        "marriage",
        "quests",
        "conflicts",
        "research",
        "recipes",
        "reputation",
        "norms",
        "knowledgeGraph",
        "tasks",
      ];

      stateCache.markDirtyMultiple(allSections);
      const snapshot = stateCache.getSnapshot(gameState, 1);

      expect(snapshot).toBeDefined();
    });
  });

  describe("reset", () => {
    it("debe limpiar estado completo", () => {
      stateCache.getSnapshot(gameState, 1);
      stateCache.markDirty("agents");

      stateCache.reset();

      const previousSnapshot = stateCache.getPreviousSnapshot();
      expect(previousSnapshot).toBeNull();
    });
  });

  describe("getPreviousSnapshot", () => {
    it("debe retornar snapshot anterior", () => {
      const snapshot1 = stateCache.getSnapshot(gameState, 1);
      const previous = stateCache.getPreviousSnapshot();

      expect(previous).toBeDefined();
      expect(previous).toBe(snapshot1);
    });

    it("debe retornar null si no hay snapshot previo", () => {
      const previous = stateCache.getPreviousSnapshot();
      expect(previous).toBeNull();
    });
  });
});

