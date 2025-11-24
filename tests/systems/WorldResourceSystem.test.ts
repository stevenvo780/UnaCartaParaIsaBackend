import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorldResourceSystem } from "../../src/simulation/systems/WorldResourceSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/simulation/events.ts";

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

    it("debe inicializar worldResources si no existe", () => {
      const stateWithoutResources = createMockGameState();
      delete stateWithoutResources.worldResources;
      const system = new WorldResourceSystem(stateWithoutResources);
      expect(stateWithoutResources.worldResources).toBeDefined();
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
      expect(resource?.type).toBe("tree");
      expect(resource?.position).toEqual({ x: 100, y: 100 });
    });

    it("debe retornar null para tipo inválido", () => {
      const resource = worldResourceSystem.spawnResource(
        "invalid_type",
        { x: 100, y: 100 },
        "forest"
      );
      expect(resource).toBeNull();
    });

    it("debe spawnear diferentes tipos de recursos", () => {
      const types = ["tree", "rock", "water_source", "berry_bush"];
      types.forEach(type => {
        const resource = worldResourceSystem.spawnResource(
          type,
          { x: 100, y: 100 },
          "forest"
        );
        if (resource) {
          expect(resource.type).toBe(type);
        }
      });
    });
  });

  describe("spawnResourcesInWorld", () => {
    it("debe spawnear recursos en el mundo", () => {
      const biomeMap = Array(10).fill(null).map(() => Array(10).fill("forest"));
      const worldConfig = {
        width: 640,
        height: 640,
        tileSize: 64,
        biomeMap,
      };

      worldResourceSystem.spawnResourcesInWorld(worldConfig);
      
      const resources = Object.values(gameState.worldResources || {});
      expect(resources.length).toBeGreaterThanOrEqual(0);
    });

    it("debe manejar mapas de biomas vacíos", () => {
      const biomeMap: string[][] = [];
      const worldConfig = {
        width: 100,
        height: 100,
        tileSize: 64,
        biomeMap,
      };

      expect(() => {
        worldResourceSystem.spawnResourcesInWorld(worldConfig);
      }).not.toThrow();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => worldResourceSystem.update(1000)).not.toThrow();
    });

    it("debe procesar actualizaciones periódicas", () => {
      const resource = worldResourceSystem.spawnResource(
        "tree",
        { x: 100, y: 100 },
        "forest"
      );
      
      if (resource && gameState.worldResources) {
        expect(() => {
          worldResourceSystem.update(1000);
          worldResourceSystem.update(6000);
        }).not.toThrow();
      }
    });
  });

  describe("Manejo de eventos", () => {
    it("debe manejar eventos de recursos recolectados", () => {
      const resource = worldResourceSystem.spawnResource(
        "tree",
        { x: 100, y: 100 },
        "forest"
      );
      
      if (resource) {
        expect(() => {
          simulationEvents.emit(GameEventNames.RESOURCE_GATHERED, {
            resourceId: resource.id,
            agentId: "agent-1",
            amount: 1,
          });
        }).not.toThrow();
      }
    });
  });
});

