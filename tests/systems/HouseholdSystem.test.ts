import { describe, it, expect, beforeEach, vi } from "vitest";
import { HouseholdSystem } from "../../src/domain/simulation/systems/HouseholdSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

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

  describe("Asignación de agentes", () => {
    it("debe asignar agente a casa libre", () => {
      const zoneId = householdSystem.assignToHouse("agent-1", "head");
      expect(zoneId).toBeDefined();
      expect(zoneId).toBe("house-1");
    });

    it("debe retornar null si no hay casas libres", () => {
      // Llenar todas las casas
      const stats = householdSystem.getSystemStats();
      const capacity = stats.capacity;
      for (let i = 0; i < capacity; i++) {
        householdSystem.assignToHouse(`agent-${i}`, "other");
      }
      const zoneId = householdSystem.assignToHouse("agent-full", "other");
      expect(zoneId).toBeNull();
    });

    it("debe retornar zona existente si agente ya está asignado", () => {
      const zoneId1 = householdSystem.assignToHouse("agent-1", "head");
      const zoneId2 = householdSystem.assignToHouse("agent-1", "head");
      expect(zoneId1).toBe(zoneId2);
    });
  });

  describe("Gestión de inventario compartido", () => {
    it("debe depositar recursos en inventario compartido", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        const result = householdSystem.depositToHousehold(
          household.zoneId,
          "wood",
          10,
        );
        expect(result).toBe(true);
      }
    });

    it("debe retirar recursos del inventario compartido", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        householdSystem.depositToHousehold(household.zoneId, "wood", 10);
        const result = householdSystem.withdrawFromHousehold(
          "agent-1",
          household.zoneId,
          "wood",
          5,
        );
        expect(result).toBe(5);
      }
    });

    it("debe retornar 0 si no hay suficientes recursos", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        const result = householdSystem.withdrawFromHousehold(
          "agent-1",
          household.zoneId,
          "wood",
          100,
        );
        expect(result).toBe(0);
      }
    });

    it("debe retornar 0 si agente no es miembro del household", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        householdSystem.depositToHousehold(household.zoneId, "wood", 10);
        const result = householdSystem.withdrawFromHousehold(
          "non-member",
          household.zoneId,
          "wood",
          5,
        );
        expect(result).toBe(0);
      }
    });

    it("debe retornar inventario del household", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        householdSystem.depositToHousehold(household.zoneId, "wood", 10);
        const inventory = householdSystem.getHouseholdInventory(household.zoneId);
        expect(inventory).toBeDefined();
        expect(inventory?.wood).toBe(10);
      }
    });
  });

  describe("Rebuild desde zonas", () => {
    it("debe reconstruir households desde zonas", () => {
      gameState.zones = [
        {
          id: "new-house-1",
          type: "rest",
          bounds: { x: 200, y: 200, width: 100, height: 100 },
        },
      ];
      householdSystem.rebuildFromZones();
      const stats = householdSystem.getSystemStats();
      expect(stats.capacity).toBeGreaterThan(0);
    });

    it("debe preservar miembros existentes al reconstruir", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      expect(household).toBeDefined();
      const zoneId = household?.zoneId;
      
      householdSystem.rebuildFromZones();
      const newHousehold = householdSystem.getAgentHousehold("agent-1");
      expect(newHousehold?.zoneId).toBe(zoneId);
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas del sistema", () => {
      const stats = householdSystem.getSystemStats();
      expect(stats).toBeDefined();
      expect(stats.capacity).toBeDefined();
      expect(stats.occupancy).toBeDefined();
      expect(stats.free).toBeDefined();
      expect(stats.total).toBeDefined();
    });

    it("debe calcular ocupación correctamente", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const stats = householdSystem.getSystemStats();
      expect(stats.occupancy).toBeGreaterThan(0);
      expect(stats.occupancy).toBeLessThanOrEqual(1);
    });
  });

  describe("Eventos", () => {
    it("debe emitir evento cuando ocupación es alta", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      // Llenar casas para alta ocupación
      const stats = householdSystem.getSystemStats();
      for (let i = 0; i < stats.capacity; i++) {
        if (gameState.agents) {
          gameState.agents.push({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            position: { x: 0, y: 0 },
            ageYears: 25,
            lifeStage: "adult",
            sex: "male",
            generation: 0,
            birthTimestamp: Date.now(),
            immortal: false,
            traits: {},
            socialStatus: "commoner",
          });
        }
        householdSystem.assignToHouse(`agent-${i}`, "other");
      }
      
      householdSystem.update(10000);
      
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.HOUSEHOLD_HIGH_OCCUPANCY,
        expect.any(Object),
      );
    });

    it("debe emitir evento cuando hay agentes sin hogar", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      // Crear más agentes que capacidad
      const stats = householdSystem.getSystemStats();
      for (let i = 0; i < stats.capacity + 5; i++) {
        if (gameState.agents) {
          gameState.agents.push({
            id: `homeless-${i}`,
            name: `Homeless ${i}`,
            position: { x: 0, y: 0 },
            ageYears: 25,
            lifeStage: "adult",
            sex: "male",
            generation: 0,
            birthTimestamp: Date.now(),
            immortal: false,
            traits: {},
            socialStatus: "commoner",
          });
        }
      }
      
      householdSystem.update(10000);
      
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.HOUSEHOLD_AGENTS_HOMELESS,
        expect.any(Object),
      );
    });

    it("debe emitir evento al depositar recursos", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        householdSystem.depositToHousehold(household.zoneId, "wood", 10);
        
        expect(emitSpy).toHaveBeenCalledWith(
          GameEventNames.HOUSEHOLD_RESOURCE_DEPOSITED,
          expect.objectContaining({
            householdId: household.zoneId,
            resource: "wood",
            amount: 10,
          }),
        );
      }
    });

    it("debe emitir evento al retirar recursos", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        householdSystem.depositToHousehold(household.zoneId, "wood", 10);
        householdSystem.withdrawFromHousehold("agent-1", household.zoneId, "wood", 5);
        
        expect(emitSpy).toHaveBeenCalledWith(
          GameEventNames.HOUSEHOLD_RESOURCE_WITHDRAWN,
          expect.objectContaining({
            agentId: "agent-1",
            householdId: household.zoneId,
            resource: "wood",
            amount: 5,
          }),
        );
      }
    });
  });

  describe("Obtener información", () => {
    it("debe retornar household por zoneId", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const household = householdSystem.getAgentHousehold("agent-1");
      if (household) {
        const retrieved = householdSystem.getHousehold(household.zoneId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.zoneId).toBe(household.zoneId);
      }
    });

    it("debe retornar zona de casa para agente", () => {
      householdSystem.assignToHouse("agent-1", "head");
      const zone = householdSystem.getHouseFor("agent-1");
      expect(zone).toBeDefined();
      expect(zone?.id).toBe("house-1");
    });

    it("debe retornar null para agente sin casa", () => {
      const zone = householdSystem.getHouseFor("non-existent");
      expect(zone).toBeNull();
    });
  });
});

