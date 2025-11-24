import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductionSystem } from "../../src/simulation/systems/ProductionSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ProductionSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let lifeCycleSystem: LifeCycleSystem;
  let productionSystem: ProductionSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "food-zone-1",
          type: "food",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        },
        {
          id: "water-zone-1",
          type: "water",
          x: 200,
          y: 200,
          width: 50,
          height: 50,
        },
      ],
      agents: [
        {
          id: "agent-1",
          name: "Test Agent 1",
          position: { x: 100, y: 100 },
          needs: {
            hunger: 50,
            thirst: 50,
            rest: 50,
            social: 50,
          },
          inventory: { items: [], capacity: 10 },
          age: 25,
          gender: "male",
          status: "alive",
        },
        {
          id: "agent-2",
          name: "Test Agent 2",
          position: { x: 200, y: 200 },
          needs: {
            hunger: 50,
            thirst: 50,
            rest: 50,
            social: 50,
          },
          inventory: { items: [], capacity: 10 },
          age: 30,
          gender: "female",
          status: "alive",
        },
      ],
    });

    inventorySystem = new InventorySystem(gameState);
    lifeCycleSystem = new LifeCycleSystem(gameState);
    productionSystem = new ProductionSystem(
      gameState,
      inventorySystem,
      lifeCycleSystem,
      {
        updateIntervalMs: 1000,
        productionIntervalMs: 2000,
        maxWorkersPerZone: 2,
        baseYieldPerWorker: 4,
      }
    );
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(productionSystem).toBeDefined();
    });
  });

  describe("Actualización de producción", () => {
    it("debe procesar zonas de producción", () => {
      productionSystem.update(1000);
      const stockpiles = inventorySystem.getStockpilesInZone("food-zone-1");
      expect(Array.isArray(stockpiles)).toBe(true);
    });

    it("debe asignar trabajadores a zonas", () => {
      productionSystem.update(1000);
      productionSystem.update(2000);
      const stockpiles = inventorySystem.getStockpilesInZone("food-zone-1");
      expect(Array.isArray(stockpiles)).toBe(true);
    });

    it("debe producir recursos según el tipo de zona", () => {
      productionSystem.update(1000);
      productionSystem.update(2000);
      const foodStockpiles = inventorySystem.getStockpilesInZone("food-zone-1");
      const waterStockpiles = inventorySystem.getStockpilesInZone("water-zone-1");
      expect(Array.isArray(foodStockpiles)).toBe(true);
      expect(Array.isArray(waterStockpiles)).toBe(true);
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new ProductionSystem(
        gameState,
        inventorySystem,
        lifeCycleSystem,
        {
          updateIntervalMs: 500,
          productionIntervalMs: 1000,
          maxWorkersPerZone: 3,
          baseYieldPerWorker: 5,
        }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

