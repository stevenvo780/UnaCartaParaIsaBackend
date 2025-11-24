import { describe, it, expect, beforeEach } from "vitest";
import { MarketSystem } from "../../src/simulation/systems/MarketSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("MarketSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let lifeCycleSystem: LifeCycleSystem;
  let marketSystem: MarketSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "buyer-1",
          position: { x: 100, y: 100 },
          type: "agent",
          stats: { money: 100 },
        },
        {
          id: "seller-1",
          position: { x: 200, y: 200 },
          type: "agent",
          stats: { money: 0 },
        },
      ],
      resources: {
        materials: {
          food: 50,
          water: 30,
          wood: 40,
          stone: 20,
        },
        energy: 0,
        currency: 0,
        experience: 0,
        unlockedFeatures: [],
      },
    });

    inventorySystem = new InventorySystem();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    marketSystem = new MarketSystem(gameState, inventorySystem, lifeCycleSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(marketSystem).toBeDefined();
    });
  });

  describe("Precios de recursos", () => {
    it("debe retornar precio de recurso", () => {
      const price = marketSystem.getResourcePrice("food");
      expect(price).toBeGreaterThan(0);
    });

    it("debe calcular precio según escasez", () => {
      gameState.resources!.materials.food = 5; // Bajo stock
      const lowPrice = marketSystem.getResourcePrice("food");
      
      gameState.resources!.materials.food = 200; // Alto stock
      const highPrice = marketSystem.getResourcePrice("food");
      
      expect(lowPrice).toBeGreaterThan(highPrice);
    });
  });

  describe("Compra de recursos", () => {
    it("debe permitir comprar recursos", () => {
      inventorySystem.initializeAgentInventory("buyer-1");
      const bought = marketSystem.buyResource("buyer-1", "food", 5);
      expect(bought).toBe(true);
      
      const inventory = inventorySystem.getAgentInventory("buyer-1");
      expect(inventory?.food).toBe(5);
    });

    it("debe retornar false si no hay suficiente dinero", () => {
      const entity = gameState.entities.find(e => e.id === "buyer-1");
      if (entity && entity.stats) {
        entity.stats.money = 1;
      }
      
      const bought = marketSystem.buyResource("buyer-1", "food", 10);
      expect(bought).toBe(false);
    });

    it("debe retornar false si el inventario está lleno", () => {
      inventorySystem.initializeAgentInventory("buyer-1", 5);
      inventorySystem.addResource("buyer-1", "food", 5);
      
      const bought = marketSystem.buyResource("buyer-1", "food", 10);
      expect(bought).toBe(false);
    });
  });

  describe("Venta de recursos", () => {
    it("debe permitir vender recursos", () => {
      inventorySystem.initializeAgentInventory("seller-1");
      inventorySystem.addResource("seller-1", "wood", 10);
      
      const value = marketSystem.sellResource("seller-1", "wood", 5);
      expect(value).toBeGreaterThan(0);
      
      const inventory = inventorySystem.getAgentInventory("seller-1");
      expect(inventory?.wood).toBe(5);
    });

    it("debe retornar 0 si no hay recursos para vender", () => {
      inventorySystem.initializeAgentInventory("seller-1");
      const value = marketSystem.sellResource("seller-1", "wood", 10);
      expect(value).toBe(0);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => marketSystem.update(1000)).not.toThrow();
    });
  });
});

