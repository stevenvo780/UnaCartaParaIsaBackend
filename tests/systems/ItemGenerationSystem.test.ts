import { describe, it, expect, beforeEach, vi } from "vitest";
import { ItemGenerationSystem } from "../../src/domain/simulation/systems/ItemGenerationSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

describe("ItemGenerationSystem", () => {
  let gameState: GameState;
  let itemGenerationSystem: ItemGenerationSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "zone-1",
          type: "work",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
        {
          id: "zone-2",
          type: "food",
          x: 200,
          y: 200,
          width: 50,
          height: 50,
          bounds: { x: 200, y: 200, width: 50, height: 50 },
        },
      ],
    });
    itemGenerationSystem = new ItemGenerationSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(itemGenerationSystem).toBeDefined();
    });

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new ItemGenerationSystem(gameState, {
        enableAutoGeneration: false,
        generationIntervalSec: 30,
        maxItemsPerZone: 5,
      });
      expect(customSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => itemGenerationSystem.update(1000)).not.toThrow();
    });

    it("no debe generar si auto-generación está deshabilitada", () => {
      const customSystem = new ItemGenerationSystem(gameState, {
        enableAutoGeneration: false,
      });
      customSystem.update(100000);
      const stats = customSystem.getGenerationStats();
      expect(stats.totalItems).toBe(0);
    });
  });

  describe("addGenerationRule", () => {
    it("debe agregar regla de generación", () => {
      const rule = {
        itemId: "test_item",
        zoneType: "work",
        spawnChance: 0.5,
        minQuantity: 1,
        maxQuantity: 3,
        respawnTime: 10000,
      };
      expect(() => {
        itemGenerationSystem.addGenerationRule(rule);
      }).not.toThrow();
    });
  });

  describe("forceSpawnItem", () => {
    it("debe generar item forzado en zona válida", () => {
      const result = itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      expect(result).toBe(true);
    });

    it("debe retornar false para zona inexistente", () => {
      const result = itemGenerationSystem.forceSpawnItem("nonexistent", "test_item", 5);
      expect(result).toBe(false);
    });

    it("debe emitir evento al generar item", () => {
      const eventSpy = vi.fn();
      simulationEvents.on(GameEventNames.ITEM_GENERATED, eventSpy);
      
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      
      expect(eventSpy).toHaveBeenCalled();
      simulationEvents.off(GameEventNames.ITEM_GENERATED, eventSpy);
    });
  });

  describe("collectItemsFromZone", () => {
    it("debe retornar array vacío para zona sin items", () => {
      const collected = itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      expect(collected).toEqual([]);
    });

    it("debe recolectar items de zona", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      const collected = itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      expect(collected.length).toBeGreaterThan(0);
      expect(collected[0].itemId).toBe("test_item");
      expect(collected[0].quantity).toBe(5);
    });

    it("debe emitir evento al recolectar", () => {
      const eventSpy = vi.fn();
      simulationEvents.on(GameEventNames.ITEM_COLLECTED, eventSpy);
      
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      
      expect(eventSpy).toHaveBeenCalled();
      simulationEvents.off(GameEventNames.ITEM_COLLECTED, eventSpy);
    });

    it("no debe recolectar items ya recolectados", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      const collected = itemGenerationSystem.collectItemsFromZone("zone-1", "agent-2");
      expect(collected).toEqual([]);
    });
  });

  describe("getZoneItems", () => {
    it("debe retornar array vacío para zona sin items", () => {
      const items = itemGenerationSystem.getZoneItems("zone-1");
      expect(items).toEqual([]);
    });

    it("debe retornar items no recolectados", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      const items = itemGenerationSystem.getZoneItems("zone-1");
      expect(items.length).toBe(1);
      expect(items[0].itemId).toBe("test_item");
    });

    it("no debe retornar items recolectados", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      const items = itemGenerationSystem.getZoneItems("zone-1");
      expect(items).toEqual([]);
    });
  });

  describe("clearZoneItems", () => {
    it("debe limpiar items de zona", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.clearZoneItems("zone-1");
      const items = itemGenerationSystem.getZoneItems("zone-1");
      expect(items).toEqual([]);
    });
  });

  describe("getGenerationStats", () => {
    it("debe retornar estadísticas vacías inicialmente", () => {
      const stats = itemGenerationSystem.getGenerationStats();
      expect(stats.totalZonesWithItems).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.itemsByType).toEqual({});
    });

    it("debe contar items generados", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.forceSpawnItem("zone-2", "other_item", 3);
      const stats = itemGenerationSystem.getGenerationStats();
      expect(stats.totalZonesWithItems).toBe(2);
      expect(stats.totalItems).toBe(8);
      expect(stats.itemsByType["test_item"]).toBe(5);
      expect(stats.itemsByType["other_item"]).toBe(3);
    });

    it("no debe contar items recolectados", () => {
      itemGenerationSystem.forceSpawnItem("zone-1", "test_item", 5);
      itemGenerationSystem.collectItemsFromZone("zone-1", "agent-1");
      const stats = itemGenerationSystem.getGenerationStats();
      expect(stats.totalItems).toBe(0);
    });
  });
});
