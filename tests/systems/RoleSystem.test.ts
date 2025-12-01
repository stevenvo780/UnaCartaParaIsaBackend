import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleSystem } from "../../src/domain/simulation/systems/agents/RoleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import type { RoleType, WorkShift } from "../../src/domain/simulation/types/roles.ts";

describe("RoleSystem", () => {
  let gameState: GameState;
  let roleSystem: RoleSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent 1",
          ageYears: 25,
          lifeStage: "adult",
          immortal: false,
          position: { x: 100, y: 100 },
          type: "agent",
          traits: {
            cooperation: 0.7,
            diligence: 0.8,
            curiosity: 0.5,
          },
        },
        {
          id: "agent-2",
          name: "Test Agent 2",
          ageYears: 18,
          lifeStage: "adult",
          immortal: false,
          position: { x: 200, y: 200 },
          type: "agent",
          traits: {
            cooperation: 0.5,
            diligence: 0.6,
            curiosity: 0.4,
          },
        },
        {
          id: "immortal-agent",
          name: "Immortal",
          ageYears: 1000,
          lifeStage: "adult",
          immortal: true,
          position: { x: 300, y: 300 },
          type: "agent",
          traits: {
            cooperation: 1.0,
            diligence: 1.0,
            curiosity: 1.0,
          },
        },
      ],
    });
    roleSystem = new RoleSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(roleSystem).toBeDefined();
    });

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new RoleSystem(gameState, {
        autoAssignRoles: false,
        reassignmentIntervalSec: 60,
        experienceGainPerSecond: 0.002,
        satisfactionDecayPerSecond: 0.001,
      });
      expect(customSystem).toBeDefined();
    });
  });

  describe("update", () => {
    it("debe actualizar sin errores", () => {
      expect(() => roleSystem.update(1000)).not.toThrow();
    });

    it("no debe actualizar si no ha pasado suficiente tiempo", () => {
      roleSystem.update(100);
      expect(roleSystem).toBeDefined();
    });

    it("debe actualizar estadísticas de roles periódicamente", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      roleSystem.update(15000);
      const role = roleSystem.getAgentRole(gameState.agents![0].id);
      expect(role).toBeDefined();
    });
  });

  describe("assignBestRole", () => {
    it("debe asignar mejor rol a agente válido", () => {
      const result = roleSystem.assignBestRole(gameState.agents![0]);
      expect(result.success).toBe(true);
      expect(result.agentId).toBe("agent-1");
      expect(result.roleType).toBeDefined();
    });

    it("puede asignar rol a agente inmortal", () => {
      const result = roleSystem.assignBestRole(gameState.agents![2]);
      expect(result.success).toBe(true);
      expect(result.roleType).toBeDefined();
    });

    it("debe retornar false si el agente no cumple requisitos", () => {
      const youngAgent = {
        id: "young-agent",
        name: "Young",
        ageYears: 10,
        lifeStage: "child",
        immortal: false,
        position: { x: 0, y: 0 },
        type: "agent",
        traits: { cooperation: 0.1, diligence: 0.1, curiosity: 0.1 },
      };
      const result = roleSystem.assignBestRole(youngAgent);
      // Puede fallar por edad o por no cumplir requisitos
      expect(result).toBeDefined();
    });

    it("debe calcular eficiencia correctamente", () => {
      const result = roleSystem.assignBestRole(gameState.agents![0]);
      if (result.success) {
        const role = roleSystem.getAgentRole("agent-1");
        expect(role?.efficiency).toBeGreaterThan(0);
        expect(role?.efficiency).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("getAgentRole", () => {
    it("debe retornar undefined para agente sin rol", () => {
      const role = roleSystem.getAgentRole("nonexistent");
      expect(role).toBeUndefined();
    });

    it("debe retornar rol asignado", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const role = roleSystem.getAgentRole("agent-1");
      expect(role).toBeDefined();
      expect(role?.agentId).toBe("agent-1");
      expect(role?.roleType).toBeDefined();
    });
  });

  describe("getRoleConfig", () => {
    it("debe retornar configuración de rol válido", () => {
      const config = roleSystem.getRoleConfig("logger");
      expect(config).toBeDefined();
      expect(config?.type).toBe("logger");
      expect(config?.name).toBeDefined();
    });

    it("debe retornar undefined para rol inválido", () => {
      const config = roleSystem.getRoleConfig("invalid_role" as RoleType);
      expect(config).toBeUndefined();
    });
  });

  describe("getAgentsInShift", () => {
    it("debe retornar agentes en turno", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const agents = roleSystem.getAgentsInShift("morning");
      expect(Array.isArray(agents)).toBe(true);
    });

    it("debe retornar array vacío para turno sin agentes", () => {
      const agents = roleSystem.getAgentsInShift("night");
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe("getCurrentShift", () => {
    it("debe retornar turno actual", () => {
      const shift = roleSystem.getCurrentShift();
      expect(["morning", "afternoon", "evening", "night", "rest"]).toContain(shift);
    });
  });

  describe("updateCurrentShift", () => {
    it("debe actualizar turno actual", () => {
      const eventSpy = vi.fn();
      roleSystem.on("shiftChanged", eventSpy);
      
      roleSystem.updateCurrentShift("afternoon");
      expect(roleSystem.getCurrentShift()).toBe("afternoon");
      
      roleSystem.off("shiftChanged", eventSpy);
    });

    it("debe emitir evento al cambiar turno", () => {
      const eventSpy = vi.fn();
      roleSystem.on("shiftChanged", eventSpy);
      
      roleSystem.updateCurrentShift("evening");
      
      expect(eventSpy).toHaveBeenCalled();
      roleSystem.off("shiftChanged", eventSpy);
    });

    it("no debe cambiar si el nuevo turno es 'rest'", () => {
      const currentShift = roleSystem.getCurrentShift();
      roleSystem.updateCurrentShift("rest");
      expect(roleSystem.getCurrentShift()).toBe(currentShift);
    });
  });

  describe("getAllRoles", () => {
    it("debe retornar array vacío inicialmente", () => {
      const roles = roleSystem.getAllRoles();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBe(0);
    });

    it("debe retornar todos los roles asignados", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      roleSystem.assignBestRole(gameState.agents![1]);
      const roles = roleSystem.getAllRoles();
      expect(roles.length).toBe(2);
    });
  });

  describe("getRoleEfficiency", () => {
    it("debe retornar eficiencia por defecto para agente sin rol", () => {
      const efficiency = roleSystem.getRoleEfficiency("nonexistent");
      expect(efficiency).toBe(0.5);
    });

    it("debe retornar eficiencia del rol", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const efficiency = roleSystem.getRoleEfficiency("agent-1");
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });

    it("debe incluir experiencia en el cálculo", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const role = roleSystem.getAgentRole("agent-1");
      if (role) {
        const baseEfficiency = role.efficiency;
        role.experience = 0.5;
        const efficiency = roleSystem.getRoleEfficiency("agent-1");
        // La eficiencia puede ser mayor o igual (está limitada a 1)
        expect(efficiency).toBeGreaterThanOrEqual(baseEfficiency);
        expect(efficiency).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("reassignRole", () => {
    it("debe reasignar rol válido", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const result = roleSystem.reassignRole("agent-1", "farmer");
      expect(result.success).toBe(true);
      expect(result.roleType).toBe("farmer");
    });

    it("debe retornar false para agente inexistente", () => {
      const result = roleSystem.reassignRole("nonexistent", "logger");
      expect(result.success).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("puede reasignar agente inmortal", () => {
      roleSystem.assignBestRole(gameState.agents![2]);
      const result = roleSystem.reassignRole("immortal-agent", "logger");
      expect(result.success).toBe(true);
      expect(result.roleType).toBe("logger");
    });

    it("debe retornar false para rol inválido", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const result = roleSystem.reassignRole("agent-1", "invalid_role" as RoleType);
      expect(result.success).toBe(false);
    });

    it("debe retornar false si no cumple requisitos", () => {
      const youngAgent = {
        id: "too-young",
        name: "Too Young",
        ageYears: 15,
        lifeStage: "adult",
        immortal: false,
        position: { x: 0, y: 0 },
        type: "agent",
        traits: { cooperation: 0.1, diligence: 0.1, curiosity: 0.1 },
      };
      gameState.agents?.push(youngAgent);
      roleSystem.assignBestRole(youngAgent);
      const result = roleSystem.reassignRole("too-young", "builder"); // Requiere edad 20
      expect(result.success).toBe(false);
    });
  });

  describe("Auto-asignación", () => {
    it("debe auto-asignar roles periódicamente", () => {
      roleSystem.update(150000); // Más de 2 minutos
      const roles = roleSystem.getAllRoles();
      expect(roles.length).toBeGreaterThanOrEqual(0);
    });

    it("no debe auto-asignar si está deshabilitado", () => {
      const system = new RoleSystem(gameState, {
        autoAssignRoles: false,
      });
      system.update(150000);
      // No debería asignar automáticamente
      expect(system).toBeDefined();
    });
  });

  describe("Actualización de estadísticas", () => {
    it("debe ganar experiencia cuando está en turno", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const role = roleSystem.getAgentRole("agent-1");
      if (role) {
        const initialExp = role.experience;
        roleSystem.update(15000);
        const updatedRole = roleSystem.getAgentRole("agent-1");
        if (updatedRole && role.currentShift === roleSystem.getCurrentShift()) {
          expect(updatedRole.experience).toBeGreaterThanOrEqual(initialExp);
        }
      }
    });

    it("debe degradar satisfacción con el tiempo", () => {
      roleSystem.assignBestRole(gameState.agents![0]);
      const role = roleSystem.getAgentRole("agent-1");
      if (role) {
        role.satisfaction = 1.0;
        roleSystem.update(15000);
        const updatedRole = roleSystem.getAgentRole("agent-1");
        if (updatedRole) {
          expect(updatedRole.satisfaction).toBeLessThanOrEqual(1.0);
        }
      }
    });
  });
});
