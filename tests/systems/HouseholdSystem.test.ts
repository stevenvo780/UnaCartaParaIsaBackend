import { describe, it, expect, beforeEach } from "vitest";
import { HouseholdSystem } from "../../src/simulation/systems/HouseholdSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("HouseholdSystem", () => {
  let gameState: GameState;
  let householdSystem: HouseholdSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      zones: [
        {
          id: "house-1",
          type: "rest",
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          bounds: { x: 100, y: 100, width: 100, height: 100 },
        },
      ],
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
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
      ],
    });
    householdSystem = new HouseholdSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(householdSystem).toBeDefined();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => householdSystem.update(1000)).not.toThrow();
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas del sistema", () => {
      const stats = householdSystem.getSystemStats();
      expect(stats).toBeDefined();
      expect(stats.capacity).toBeDefined();
      expect(stats.occupancy).toBeDefined();
    });
  });
});

