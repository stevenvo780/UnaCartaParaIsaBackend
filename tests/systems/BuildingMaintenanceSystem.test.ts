import { describe, it, expect, beforeEach } from "vitest";
import { BuildingMaintenanceSystem } from "../../src/simulation/systems/BuildingMaintenanceSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("BuildingMaintenanceSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let buildingMaintenanceSystem: BuildingMaintenanceSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "building-1",
          type: "rest",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          metadata: { building: "house" },
        },
      ],
    });
    inventorySystem = new InventorySystem();
    buildingMaintenanceSystem = new BuildingMaintenanceSystem(gameState, inventorySystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(buildingMaintenanceSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => buildingMaintenanceSystem.update(1000)).not.toThrow();
    });
  });

  describe("Registro de uso", () => {
    it("debe registrar uso de edificio", () => {
      expect(() => buildingMaintenanceSystem.recordUsage("building-1")).not.toThrow();
    });
  });
});

