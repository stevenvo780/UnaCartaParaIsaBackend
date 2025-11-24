import { describe, it, expect, beforeEach } from "vitest";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import type { ResourceType } from "../../src/simulation/types/economy.js";

describe("InventorySystem", () => {
  let inventorySystem: InventorySystem;

  beforeEach(() => {
    inventorySystem = new InventorySystem();
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(inventorySystem).toBeDefined();
    });
  });

  describe("Gestión de inventarios de agentes", () => {
    it("debe inicializar inventario de agente", () => {
      const inventory = inventorySystem.initializeAgentInventory("agent-1");
      expect(inventory).toBeDefined();
      expect(inventory.wood).toBe(0);
      expect(inventory.stone).toBe(0);
      expect(inventory.food).toBe(0);
      expect(inventory.water).toBe(0);
      expect(inventory.capacity).toBeGreaterThan(0);
    });

    it("debe aceptar capacidad personalizada", () => {
      const inventory = inventorySystem.initializeAgentInventory("agent-2", 100);
      expect(inventory.capacity).toBe(100);
    });

    it("debe retornar inventario de agente", () => {
      inventorySystem.initializeAgentInventory("agent-3");
      const inventory = inventorySystem.getAgentInventory("agent-3");
      expect(inventory).toBeDefined();
    });

    it("debe retornar undefined para agente inexistente", () => {
      const inventory = inventorySystem.getAgentInventory("nonexistent");
      expect(inventory).toBeUndefined();
    });
  });

  describe("Gestión de recursos", () => {
    it("debe agregar recursos a inventario de agente", () => {
      inventorySystem.initializeAgentInventory("agent-4");
      const added = inventorySystem.addResource("agent-4", "food", 10);
      expect(added).toBe(true);
      
      const inventory = inventorySystem.getAgentInventory("agent-4");
      expect(inventory?.food).toBe(10);
    });

    it("debe respetar capacidad máxima", () => {
      inventorySystem.initializeAgentInventory("agent-5", 20);
      inventorySystem.addResource("agent-5", "food", 15);
      const added = inventorySystem.addResource("agent-5", "food", 10);
      expect(added).toBe(true);
      
      const inventory = inventorySystem.getAgentInventory("agent-5");
      expect(inventory?.food).toBeLessThanOrEqual(20);
    });

    it("debe retornar false si no hay espacio", () => {
      inventorySystem.initializeAgentInventory("agent-6", 5);
      inventorySystem.addResource("agent-6", "food", 5);
      const added = inventorySystem.addResource("agent-6", "food", 1);
      expect(added).toBe(false);
    });

    it("debe remover recursos de agente", () => {
      inventorySystem.initializeAgentInventory("agent-7");
      inventorySystem.addResource("agent-7", "wood", 20);
      const removed = inventorySystem.removeFromAgent("agent-7", "wood", 10);
      expect(removed).toBe(10);
      
      const inventory = inventorySystem.getAgentInventory("agent-7");
      expect(inventory?.wood).toBe(10);
    });

    it("debe remover solo lo disponible", () => {
      inventorySystem.initializeAgentInventory("agent-8");
      inventorySystem.addResource("agent-8", "stone", 5);
      const removed = inventorySystem.removeFromAgent("agent-8", "stone", 10);
      expect(removed).toBe(5);
      
      const inventory = inventorySystem.getAgentInventory("agent-8");
      expect(inventory?.stone).toBe(0);
    });
  });

  describe("Gestión de stockpiles", () => {
    it("debe crear stockpile", () => {
      const stockpile = inventorySystem.createStockpile("zone-1", "general");
      expect(stockpile).toBeDefined();
      expect(stockpile.zoneId).toBe("zone-1");
      expect(stockpile.type).toBe("general");
    });

    it("debe retornar stockpile por ID", () => {
      const stockpile = inventorySystem.createStockpile("zone-2", "food");
      const retrieved = inventorySystem.getStockpile(stockpile.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(stockpile.id);
    });

    it("debe retornar stockpiles en zona", () => {
      inventorySystem.createStockpile("zone-3", "general");
      inventorySystem.createStockpile("zone-3", "food");
      const stockpiles = inventorySystem.getStockpilesInZone("zone-3");
      expect(stockpiles.length).toBe(2);
    });

    it("debe agregar recursos a stockpile", () => {
      const stockpile = inventorySystem.createStockpile("zone-4", "general");
      const added = inventorySystem.addToStockpile(stockpile.id, "wood", 50);
      expect(added).toBe(true);
      
      const retrieved = inventorySystem.getStockpile(stockpile.id);
      expect(retrieved?.inventory.wood).toBe(50);
    });

    it("debe consumir recursos de stockpile", () => {
      const stockpile = inventorySystem.createStockpile("zone-5", "general");
      inventorySystem.addToStockpile(stockpile.id, "food", 100);
      inventorySystem.addToStockpile(stockpile.id, "water", 50);
      
      const consumed = inventorySystem.consumeFromStockpile(stockpile.id, {
        food: 30,
        water: 20,
      });
      expect(consumed).toBe(true);
      
      const retrieved = inventorySystem.getStockpile(stockpile.id);
      expect(retrieved?.inventory.food).toBe(70);
      expect(retrieved?.inventory.water).toBe(30);
    });

    it("debe retornar false si no hay suficientes recursos", () => {
      const stockpile = inventorySystem.createStockpile("zone-6", "general");
      inventorySystem.addToStockpile(stockpile.id, "food", 10);
      
      const consumed = inventorySystem.consumeFromStockpile(stockpile.id, {
        food: 20,
      });
      expect(consumed).toBe(false);
    });
  });

  describe("Estadísticas del sistema", () => {
    it("debe retornar estadísticas del sistema", () => {
      inventorySystem.initializeAgentInventory("agent-9");
      inventorySystem.createStockpile("zone-7", "general");
      
      const stats = inventorySystem.getSystemStats();
      expect(stats).toBeDefined();
      expect(stats.totalAgentInventories).toBeGreaterThan(0);
      expect(stats.totalStockpiles).toBeGreaterThan(0);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => inventorySystem.update()).not.toThrow();
    });

    it("debe degradar comida y agua con el tiempo", () => {
      const stockpile = inventorySystem.createStockpile("zone-8", "general");
      inventorySystem.addToStockpile(stockpile.id, "food", 100);
      inventorySystem.addToStockpile(stockpile.id, "water", 100);
      
      // Simular múltiples updates
      for (let i = 0; i < 10; i++) {
        inventorySystem.update();
      }
      
      const retrieved = inventorySystem.getStockpile(stockpile.id);
      expect(retrieved?.inventory.food).toBeLessThan(100);
      expect(retrieved?.inventory.water).toBeLessThan(100);
    });
  });
});

