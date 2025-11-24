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
  });
});

