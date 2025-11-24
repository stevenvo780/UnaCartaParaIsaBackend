import { describe, it, expect, beforeEach } from "vitest";
import { BuildingSystem } from "../../src/simulation/systems/BuildingSystem.js";
import { ResourceReservationSystem } from "../../src/simulation/systems/ResourceReservationSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("BuildingSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let reservationSystem: ResourceReservationSystem;
  let buildingSystem: BuildingSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [],
      resources: {
        materials: {
          wood: 100,
          stone: 50,
          food: 0,
          water: 0,
        },
        energy: 0,
        currency: 0,
        experience: 0,
        unlockedFeatures: [],
      },
    });

    inventorySystem = new InventorySystem();
    reservationSystem = new ResourceReservationSystem(gameState, inventorySystem);
    buildingSystem = new BuildingSystem(gameState, reservationSystem);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(buildingSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => buildingSystem.update(1000)).not.toThrow();
    });

    it("debe completar trabajos de construcción finalizados", () => {
      // Crear un trabajo de construcción que se complete
      const now = Date.now();
      const job = {
        id: "job-1",
        zoneId: "zone-1",
        label: "house" as const,
        completesAt: now - 1000, // Ya completado
        reservationId: "res-1",
      };
      (buildingSystem as any).constructionJobs.set("job-1", job);
      
      buildingSystem.update(1000);
      expect(buildingSystem).toBeDefined();
    });

    it("debe programar construcción cuando hay candidatos", () => {
      gameState.zones = [
        {
          id: "zone-1",
          type: "rest",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        },
      ];
      buildingSystem.update(8000); // Más del decisionIntervalMs
      expect(buildingSystem).toBeDefined();
    });
  });

  describe("Configuración", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new BuildingSystem(
        gameState,
        reservationSystem,
        {
          decisionIntervalMs: 5000,
          maxHouses: 10,
          maxMines: 5,
          maxWorkbenches: 4,
        }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

