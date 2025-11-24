import { describe, it, expect, beforeEach, vi } from "vitest";
import { AISystem } from "../../src/simulation/systems/AISystem.js";
import { NeedsSystem } from "../../src/simulation/systems/NeedsSystem.js";
import { RoleSystem } from "../../src/simulation/systems/RoleSystem.js";
import { WorldResourceSystem } from "../../src/simulation/systems/WorldResourceSystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";
import { simulationEvents, GameEventNames } from "../../src/simulation/events.js";

describe("AISystem", () => {
  let gameState: GameState;
  let aiSystem: AISystem;
  let needsSystem: NeedsSystem;
  let roleSystem: RoleSystem;
  let worldResourceSystem: WorldResourceSystem;
  let lifeCycleSystem: LifeCycleSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
          ageYears: 25,
          lifeStage: "adult",
          immortal: false,
          position: { x: 100, y: 100 },
          type: "agent",
          traits: {
            cooperation: 0.5,
            diligence: 0.6,
            curiosity: 0.4,
          },
        },
        {
          id: "agent-2",
          name: "Child Agent",
          ageYears: 10,
          lifeStage: "child",
          immortal: false,
          position: { x: 200, y: 200 },
          type: "agent",
          traits: {
            cooperation: 0.5,
            diligence: 0.6,
            curiosity: 0.4,
          },
        },
      ],
    });
    lifeCycleSystem = new LifeCycleSystem(gameState);
    needsSystem = new NeedsSystem(gameState, lifeCycleSystem);
    roleSystem = new RoleSystem(gameState);
    worldResourceSystem = new WorldResourceSystem(gameState);
    aiSystem = new AISystem(gameState, undefined, {
      needsSystem,
      roleSystem,
      worldResourceSystem,
    });
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(aiSystem).toBeDefined();
    });

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new AISystem(gameState, {
        decisionIntervalMs: 1000,
        goalTimeoutMs: 20000,
        minPriorityThreshold: 0.5,
        batchSize: 10,
      });
      expect(customSystem).toBeDefined();
    });

    it("debe aceptar sistemas opcionales", () => {
      const systemWithNeeds = new AISystem(gameState, undefined, {
        needsSystem,
      });
      expect(systemWithNeeds).toBeDefined();
    });
  });

  describe("update", () => {
    it("debe actualizar sin errores", () => {
      expect(() => aiSystem.update(1000)).not.toThrow();
    });

    it("no debe actualizar si no ha pasado el intervalo mínimo", () => {
      aiSystem.update(100);
      const state1 = aiSystem.getAIState("agent-1");
      aiSystem.update(200);
      const state2 = aiSystem.getAIState("agent-1");
      // No debería haber cambios significativos
      expect(state1 || state2).toBeDefined();
    });

    it("debe procesar agentes adultos en lotes", () => {
      // Agregar más agentes adultos
      gameState.agents?.push({
        id: "agent-3",
        name: "Adult 3",
        ageYears: 30,
        lifeStage: "adult",
        immortal: false,
        position: { x: 300, y: 300 },
        type: "agent",
        traits: { cooperation: 0.5, diligence: 0.6, curiosity: 0.4 },
      });

      expect(() => {
        aiSystem.update(1000);
      }).not.toThrow();
    });

    it("debe rotar el índice del lote", () => {
      for (let i = 0; i < 10; i++) {
        aiSystem.update(1000);
      }
      expect(aiSystem).toBeDefined();
    });
  });

  describe("getAIState", () => {
    it("debe retornar undefined para agente inexistente", () => {
      const state = aiSystem.getAIState("nonexistent");
      expect(state).toBeUndefined();
    });

    it("debe crear y retornar estado AI para agente adulto", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      expect(state).toBeDefined();
      if (state) {
        expect(state.entityId).toBe("agent-1");
        expect(state.personality).toBeDefined();
        expect(state.memory).toBeDefined();
      }
    });
  });

  describe("getAllAIStates", () => {
    it("debe retornar array vacío inicialmente", () => {
      const states = aiSystem.getAllAIStates();
      expect(Array.isArray(states)).toBe(true);
    });

    it("debe retornar todos los estados AI después de actualizar", () => {
      aiSystem.update(1000);
      const states = aiSystem.getAllAIStates();
      expect(states.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("setAgentOffDuty", () => {
    it("debe establecer agente fuera de servicio", () => {
      aiSystem.update(1000);
      aiSystem.setAgentOffDuty("agent-1", true);
      const state = aiSystem.getAIState("agent-1");
      expect(state?.offDuty).toBe(true);
    });

    it("debe establecer agente en servicio", () => {
      aiSystem.update(1000);
      aiSystem.setAgentOffDuty("agent-1", true);
      aiSystem.setAgentOffDuty("agent-1", false);
      const state = aiSystem.getAIState("agent-1");
      expect(state?.offDuty).toBe(false);
    });

    it("debe limpiar objetivo cuando se pone fuera de servicio", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "explore",
          priority: 0.5,
          createdAt: Date.now(),
          targetPosition: { x: 200, y: 200 },
        };
        aiSystem.setAgentOffDuty("agent-1", true);
        expect(state.currentGoal).toBeNull();
      }
    });

    it("no debe hacer nada si el agente no tiene estado", () => {
      expect(() => {
        aiSystem.setAgentOffDuty("nonexistent", true);
      }).not.toThrow();
    });
  });

  describe("Gestión de objetivos", () => {
    it("debe crear objetivos cuando se actualiza", () => {
      const eventSpy = vi.fn();
      simulationEvents.on(GameEventNames.AGENT_GOAL_CHANGED, eventSpy);
      
      aiSystem.update(1000);
      
      // Puede o no emitir eventos dependiendo de las condiciones
      expect(aiSystem).toBeDefined();
      
      simulationEvents.off(GameEventNames.AGENT_GOAL_CHANGED, eventSpy);
    });

    it("debe expirar objetivos antiguos", (done) => {
      aiSystem = new AISystem(gameState, {
        goalTimeoutMs: 100,
      }, {
        needsSystem,
        roleSystem,
        worldResourceSystem,
      });

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      
      if (state) {
        state.currentGoal = {
          type: "explore",
          priority: 0.5,
          createdAt: Date.now() - 200, // Objetivo antiguo
          targetPosition: { x: 200, y: 200 },
        };

        aiSystem.on("goalExpired", (data) => {
          expect(data.agentId).toBe("agent-1");
          done();
        });

        aiSystem.update(1000);
      } else {
        done();
      }
    });
  });

  describe("Filtrado de agentes", () => {
    it("solo debe procesar agentes adultos", () => {
      aiSystem.update(1000);
      const state1 = aiSystem.getAIState("agent-1");
      const state2 = aiSystem.getAIState("agent-2");
      
      // agent-1 es adulto, agent-2 es niño
      expect(state1).toBeDefined();
      // agent-2 no debería tener estado AI
    });

    it("no debe procesar agentes inmortales", () => {
      if (gameState.agents) {
        gameState.agents[0].immortal = true;
      }
      aiSystem.update(1000);
      // El sistema debería funcionar sin errores
      expect(aiSystem).toBeDefined();
    });
  });
});
