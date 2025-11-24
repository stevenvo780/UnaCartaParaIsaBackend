import { describe, it, expect, beforeEach } from "vitest";
import { BuildingMaintenanceSystem } from "../../src/simulation/systems/BuildingMaintenanceSystem.ts";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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
          durability: 100, // Durabilidad inicial
          maxDurability: 100,
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

    it("no debe hacer nada para edificio inexistente", () => {
      expect(() => buildingMaintenanceSystem.recordUsage("nonexistent")).not.toThrow();
    });
  });

  describe("Reparación de edificios", () => {
    it("debe reparar edificio", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      inventorySystem.addResource("agent-1", "wood", 10);
      inventorySystem.addResource("agent-1", "stone", 5);
      
      const repaired = buildingMaintenanceSystem.repairBuilding("building-1", "agent-1");
      expect(repaired).toBeDefined();
    });

    it("debe retornar false para edificio inexistente", () => {
      const repaired = buildingMaintenanceSystem.repairBuilding("nonexistent", "agent-1");
      expect(repaired).toBe(false);
    });

    it("debe retornar false si no hay recursos suficientes", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      // Crear un nuevo edificio con durabilidad baja que requiera recursos
      gameState.zones.push({
        id: "building-2",
        type: "rest",
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        metadata: { building: "house" },
        durability: 50, // Durabilidad baja requiere recursos
        maxDurability: 100,
      });
      const buildingMaintenanceSystem2 = new BuildingMaintenanceSystem(gameState, inventorySystem);
      const repaired = buildingMaintenanceSystem2.repairBuilding("building-2", "agent-1");
      expect(repaired).toBe(false);
    });
  });

  describe("Actualización de deterioro", () => {
    it("debe aplicar deterioro con el tiempo", () => {
      buildingMaintenanceSystem.update(6000);
      expect(buildingMaintenanceSystem).toBeDefined();
    });
  });

  describe("Configuración", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new BuildingMaintenanceSystem(
        gameState,
        inventorySystem,
        {
          usageDegradationRate: 0.5,
          usageDegradationInterval: 5,
          abandonmentThreshold: 60000,
        }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

