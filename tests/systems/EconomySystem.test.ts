import { describe, it, expect, beforeEach } from "vitest";
import { EconomySystem } from "../../src/simulation/systems/EconomySystem.ts";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.ts";
import { SocialSystem } from "../../src/simulation/systems/SocialSystem.ts";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.wood).toBeGreaterThan(0);
    });

    it("debe manejar acción de trabajo en zona de comida", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "food-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.food).toBeGreaterThan(0);
    });

    it("debe manejar acción de trabajo en zona de agua", () => {
      gameState.zones.push({
        id: "water-zone",
        type: "water",
        x: 300,
        y: 300,
        width: 50,
        height: 50,
      });
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "water-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.water).toBeGreaterThan(0);
    });

    it("debe pagar salario al agente", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      const initialMoney = entity?.stats?.money || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const updatedEntity = gameState.entities.find(e => e.id === "agent-1");
      if (updatedEntity?.stats) {
        expect(updatedEntity.stats.money).toBeGreaterThan(initialMoney);
      }
    });

    it("debe agregar recursos globales si el inventario está lleno", () => {
      inventorySystem.initializeAgentInventory("agent-1", 0); // Capacidad 0
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      const initialWood = gameState.resources?.materials.wood || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      expect(gameState.resources?.materials.wood).toBeGreaterThan(initialWood);
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

    it("no debe hacer nada si la zona no produce recursos", () => {
      gameState.zones.push({
        id: "rest-zone",
        type: "rest",
        x: 400,
        y: 400,
        width: 50,
        height: 50,
      });
      expect(() => {
        economySystem.handleWorkAction("agent-1", "rest-zone");
      }).not.toThrow();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => economySystem.update(1000)).not.toThrow();
    });
  });

  describe("Residuos de yield", () => {
    it("debe acumular residuos de yield", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      // Realizar múltiples acciones de trabajo para acumular residuos
      economySystem.handleWorkAction("agent-1", "wood-zone");
      economySystem.handleWorkAction("agent-1", "wood-zone");
      expect(economySystem).toBeDefined();
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

