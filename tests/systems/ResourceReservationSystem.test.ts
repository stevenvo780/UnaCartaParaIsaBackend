import { describe, it, expect, beforeEach } from "vitest";
import { ResourceReservationSystem } from "../../src/simulation/systems/ResourceReservationSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("ResourceReservationSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let reservationSystem: ResourceReservationSystem;

  beforeEach(() => {
    gameState = createMockGameState({
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
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(reservationSystem).toBeDefined();
    });
  });

  describe("Reserva de recursos", () => {
    it("debe reservar recursos", () => {
      const reserved = reservationSystem.reserve("task-1", { wood: 10, stone: 5 });
      expect(reserved).toBe(true);
    });

    it("debe retornar false si no hay recursos suficientes", () => {
      const reserved = reservationSystem.reserve("task-2", { wood: 1000, stone: 1000 });
      expect(reserved).toBe(false);
    });

    it("debe retornar false si la tarea ya está reservada", () => {
      reservationSystem.reserve("task-3", { wood: 10, stone: 5 });
      const reservedAgain = reservationSystem.reserve("task-3", { wood: 5, stone: 2 });
      expect(reservedAgain).toBe(false);
    });
  });

  describe("Consumo de recursos", () => {
    it("debe consumir recursos reservados", () => {
      reservationSystem.reserve("task-4", { wood: 10, stone: 5 });
      const consumed = reservationSystem.consume("task-4");
      expect(consumed).toBe(true);
    });

    it("debe retornar false si no hay reserva", () => {
      const consumed = reservationSystem.consume("nonexistent");
      expect(consumed).toBe(false);
    });
  });

  describe("Liberación de recursos", () => {
    it("debe liberar recursos reservados", () => {
      reservationSystem.reserve("task-5", { wood: 10, stone: 5 });
      const released = reservationSystem.release("task-5");
      expect(released).toBe(true);
    });

    it("debe retornar false si no hay reserva para liberar", () => {
      const released = reservationSystem.release("nonexistent");
      expect(released).toBe(false);
    });
  });

  describe("Recursos disponibles", () => {
    it("debe calcular recursos disponibles", () => {
      reservationSystem.reserve("task-6", { wood: 10, stone: 5 });
      const available = reservationSystem.getAvailableResources(false);
      expect(available.wood).toBeLessThan(100);
      expect(available.stone).toBeLessThan(50);
    });

    it("debe incluir recursos reservados si se solicita", () => {
      reservationSystem.reserve("task-7", { wood: 10, stone: 5 });
      const available = reservationSystem.getAvailableResources(true);
      expect(available.wood).toBe(100);
      expect(available.stone).toBe(50);
    });
  });

  describe("Total reservado", () => {
    it("debe calcular total de recursos reservados", () => {
      reservationSystem.reserve("task-8", { wood: 10, stone: 5 });
      reservationSystem.reserve("task-9", { wood: 20, stone: 10 });
      
      const total = reservationSystem.getTotalReserved();
      expect(total.wood).toBe(30);
      expect(total.stone).toBe(15);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => reservationSystem.update()).not.toThrow();
    });
  });
});

