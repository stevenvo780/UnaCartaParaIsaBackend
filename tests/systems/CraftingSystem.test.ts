import { describe, it, expect, beforeEach } from "vitest";
import { CraftingSystem } from "../../src/simulation/systems/CraftingSystem.ts";
import { EnhancedCraftingSystem } from "../../src/simulation/systems/EnhancedCraftingSystem.ts";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("CraftingSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let enhancedCrafting: EnhancedCraftingSystem;
  let craftingSystem: CraftingSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "crafting-station",
          type: "work",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          metadata: { craftingStation: true },
        },
      ],
    });

    inventorySystem = new InventorySystem();
    enhancedCrafting = new EnhancedCraftingSystem(gameState, inventorySystem);
    craftingSystem = new CraftingSystem(gameState, enhancedCrafting);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(craftingSystem).toBeDefined();
    });
  });

  describe("Verificación de crafting", () => {
    it("debe verificar si se puede craftear arma", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const canCraft = craftingSystem.canCraftWeapon("agent-1", "wooden_sword");
      expect(typeof canCraft).toBe("boolean");
    });

    it("debe retornar false si no hay estación de crafting", () => {
      const systemWithoutStation = new CraftingSystem(
        createMockGameState({ zones: [] }),
        enhancedCrafting,
        { requireCraftingStation: true }
      );
      
      const canCraft = systemWithoutStation.canCraftWeapon("agent-1", "wooden_sword");
      expect(canCraft).toBe(false);
    });
  });

  describe("Crafting de armas", () => {
    it("debe sugerir zona de crafting", () => {
      const zoneId = craftingSystem.getSuggestedCraftZone();
      expect(zoneId).toBe("crafting-station");
    });

    it("debe retornar undefined si no hay estación", () => {
      const systemWithoutStation = new CraftingSystem(
        createMockGameState({ zones: [] }),
        enhancedCrafting
      );
      
      const zoneId = systemWithoutStation.getSuggestedCraftZone();
      expect(zoneId).toBeUndefined();
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new CraftingSystem(
        gameState,
        enhancedCrafting,
        { requireCraftingStation: false }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

