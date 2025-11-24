import { describe, it, expect, beforeEach } from "vitest";
import { EconomySystem } from "../../src/simulation/systems/EconomySystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { SocialSystem } from "../../src/simulation/systems/SocialSystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("EconomySystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let socialSystem: SocialSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let economySystem: EconomySystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "agent-1",
          position: { x: 100, y: 100 },
          type: "agent",
        },
      ],
      zones: [
        {
          id: "wood-zone",
          type: "work",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          props: { resource: "wood" },
        },
        {
          id: "food-zone",
          type: "food",
          x: 200,
          y: 200,
          width: 50,
          height: 50,
        },
      ],
    });

    inventorySystem = new InventorySystem();
    socialSystem = new SocialSystem(gameState);
    lifeCycleSystem = new LifeCycleSystem(gameState);
    economySystem = new EconomySystem(
      gameState,
      inventorySystem,
      socialSystem,
      lifeCycleSystem
    );
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(economySystem).toBeDefined();
    });
  });

  describe("Acciones de trabajo", () => {
    it("debe manejar acción de trabajo en zona de madera", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.wood).toBeGreaterThan(0);
    });

    it("debe manejar acción de trabajo en zona de comida", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      economySystem.handleWorkAction("agent-1", "food-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.food).toBeGreaterThan(0);
    });

    it("no debe hacer nada si el agente no existe", () => {
      expect(() => {
        economySystem.handleWorkAction("nonexistent", "wood-zone");
      }).not.toThrow();
    });

    it("no debe hacer nada si la zona no existe", () => {
      expect(() => {
        economySystem.handleWorkAction("agent-1", "nonexistent");
      }).not.toThrow();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => economySystem.update(1000)).not.toThrow();
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new EconomySystem(
        gameState,
        inventorySystem,
        socialSystem,
        lifeCycleSystem,
        {
          workDurationMs: 3000,
          baseYield: {
            wood: 2,
            stone: 1.5,
            food: 3,
            water: 4,
          },
        }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

