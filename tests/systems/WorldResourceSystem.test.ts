import { describe, it, expect, beforeEach } from "vitest";
import { WorldResourceSystem } from "../../src/simulation/systems/WorldResourceSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("WorldResourceSystem", () => {
  let gameState: GameState;
  let worldResourceSystem: WorldResourceSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      worldResources: {},
    });
    worldResourceSystem = new WorldResourceSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(worldResourceSystem).toBeDefined();
    });
  });

  describe("Spawn de recursos", () => {
    it("debe spawnear recurso en el mundo", () => {
      const resource = worldResourceSystem.spawnResource(
        "tree",
        { x: 100, y: 100 },
        "forest"
      );
      expect(resource).toBeDefined();
      expect(resource?.id).toBeDefined();
    });

    it("debe retornar null para tipo inválido", () => {
      const resource = worldResourceSystem.spawnResource(
        "invalid_type",
        { x: 100, y: 100 },
        "forest"
      );
      expect(resource).toBeNull();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => worldResourceSystem.update(1000)).not.toThrow();
    });
  });
});

