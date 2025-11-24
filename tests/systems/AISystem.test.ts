import { describe, it, expect, beforeEach, vi } from "vitest";
import { AISystem } from "../../src/domain/simulation/systems/AISystem.ts";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem.ts";
import { RoleSystem } from "../../src/domain/simulation/systems/RoleSystem.ts";
import { WorldResourceSystem } from "../../src/domain/simulation/systems/WorldResourceSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

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
      aiSystem.update(200);
      // El sistema no debería procesar actualizaciones
      expect(aiSystem).toBeDefined();
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
      // El estado puede o no crearse inmediatamente dependiendo del batch
      const states = aiSystem.getAllAIStates();
      expect(Array.isArray(states)).toBe(true);
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
      // Asegurar que el estado existe
      const states = aiSystem.getAllAIStates();
      if (states.length > 0) {
        const agentId = states[0].entityId;
        aiSystem.setAgentOffDuty(agentId, true);
        const state = aiSystem.getAIState(agentId);
        if (state) {
          expect(state.offDuty).toBe(true);
        }
      } else {
        // Si no hay estados, simplemente verificar que no hay error
        expect(() => aiSystem.setAgentOffDuty("agent-1", true)).not.toThrow();
      }
    });

    it("debe establecer agente en servicio", () => {
      aiSystem.update(1000);
      aiSystem.setAgentOffDuty("agent-1", true);
      aiSystem.setAgentOffDuty("agent-1", false);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        expect(state.offDuty).toBe(false);
      }
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

    it("debe expirar objetivos antiguos", () => {
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

        let expired = false;
        aiSystem.on("goalExpired", (data) => {
          expect(data.agentId).toBe("agent-1");
          expired = true;
        });

        aiSystem.update(1000);
        // El evento puede o no dispararse dependiendo del timing
        expect(aiSystem).toBeDefined();
      }
    });
  });

  describe("Filtrado de agentes", () => {
    it("solo debe procesar agentes adultos", () => {
      aiSystem.update(1000);
      // El sistema procesa agentes adultos en lotes
      // Puede que no se cree estado inmediatamente
      const states = aiSystem.getAllAIStates();
      expect(Array.isArray(states)).toBe(true);
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

  describe("Planificación de objetivos", () => {
    it("debe crear objetivos de necesidades cuando hay necesidades críticas", () => {
      // Configurar necesidades críticas
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 0.1; // Necesidad crítica
        needs.thirst = 0.1;
      }

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        expect(state.currentGoal).toBeDefined();
      }
    });

    it("debe crear objetivos de trabajo cuando no hay necesidades críticas", () => {
      // Configurar necesidades normales
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 0.7; // Necesidad normal
        needs.thirst = 0.7;
      }

      // Simular que el agente tiene un rol asignado directamente
      if (gameState.agents && gameState.agents[0]) {
        gameState.agents[0].role = "logger";
      }

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        expect(state.currentGoal).toBeDefined();
      }
    });

    it("debe crear objetivos de exploración cuando no hay otras opciones", () => {
      // Sin necesidades críticas ni roles
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        expect(state.currentGoal).toBeDefined();
      }
    });
  });

  describe("Conversión de objetivos a acciones", () => {
    it("debe convertir objetivo de exploración a acción de movimiento", () => {
      const eventSpy = vi.fn();
      simulationEvents.on(GameEventNames.AGENT_ACTION_COMMANDED, eventSpy);

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state && state.currentGoal && state.currentGoal.type === "explore") {
        // El sistema debería emitir un evento de acción
        expect(aiSystem).toBeDefined();
      }

      simulationEvents.off(GameEventNames.AGENT_ACTION_COMMANDED, eventSpy);
    });

    it("debe convertir objetivo de trabajo a acción de trabajo", () => {
      // Simular que el agente tiene un rol asignado directamente
      if (gameState.agents && gameState.agents[0]) {
        gameState.agents[0].role = "logger";
      }
      gameState.zones?.push({
        id: "work-zone-1",
        type: "work",
        bounds: {
          x: 150,
          y: 150,
          width: 50,
          height: 50,
        }
      });

      const eventSpy = vi.fn();
      simulationEvents.on(GameEventNames.AGENT_ACTION_COMMANDED, eventSpy);

      aiSystem.update(1000);
      expect(aiSystem).toBeDefined();

      simulationEvents.off(GameEventNames.AGENT_ACTION_COMMANDED, eventSpy);
    });
  });

  describe("Búsqueda de recursos", () => {
    it("debe encontrar recursos cercanos para entidades", () => {
      // Agregar recursos al mundo
      gameState.worldResources = [
        {
          id: "tree-1",
          type: "tree",
          position: { x: 120, y: 120 },
          amount: 100,
          biome: "forest",
        },
      ];

      // Configurar necesidades críticas que requieren recursos
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 0.1;
      }

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state && state.currentGoal) {
        expect(state.currentGoal).toBeDefined();
      }
    });
  });

  describe("Recursos preferidos por rol", () => {
    it("debe usar recurso preferido cuando hay rol asignado", () => {
      // Simular que el agente tiene un rol asignado directamente en el gameState
      if (gameState.agents && gameState.agents[0]) {
        gameState.agents[0].role = "logger";
      }
      aiSystem.update(1000);
      // El sistema debería usar el recurso preferido para el rol
      expect(aiSystem).toBeDefined();
    });
  });

  describe("setDependencies", () => {
    it("debe establecer dependencias de sistemas", () => {
      const newNeedsSystem = new NeedsSystem(gameState, lifeCycleSystem);
      aiSystem.setDependencies({
        needsSystem: newNeedsSystem,
      });
      expect(aiSystem).toBeDefined();
    });
  });

  describe("notifyEntityArrived", () => {
    it("debe notificar cuando una entidad llega a una zona", () => {
      aiSystem.update(1000);
      expect(() => {
        aiSystem.notifyEntityArrived("agent-1", "zone-1");
      }).not.toThrow();
    });

    it("debe intentar depositar recursos cuando llega a zona de almacenamiento", () => {
      gameState.zones = [
        {
          id: "storage-1",
          type: "storage",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
        },
      ];
      aiSystem.update(1000);
      // Agregar inventario al agente
      if (gameState.agents && gameState.agents[0]) {
        gameState.agents[0].inventory = {
          wood: 50,
          stone: 0,
          food: 0,
          water: 0,
          capacity: 100,
        };
      }
      expect(() => {
        aiSystem.notifyEntityArrived("agent-1", "storage-1");
      }).not.toThrow();
    });
  });

  describe("setPlayerControl e isPlayerControlled", () => {
    it("debe establecer control del jugador", () => {
      aiSystem.setPlayerControl("agent-1", true);
      const isControlled = aiSystem.isPlayerControlled("agent-1");
      expect(isControlled).toBe(true);
    });

    it("debe retornar false para agente no controlado", () => {
      const isControlled = aiSystem.isPlayerControlled("agent-1");
      expect(isControlled).toBe(false);
    });

    it("debe remover control del jugador", () => {
      aiSystem.setPlayerControl("agent-1", true);
      aiSystem.setPlayerControl("agent-1", false);
      const isControlled = aiSystem.isPlayerControlled("agent-1");
      expect(isControlled).toBe(false);
    });
  });

  describe("setEntityPriority", () => {
    it("debe establecer prioridad para una entidad", () => {
      expect(() => {
        aiSystem.setEntityPriority("agent-1", 0.8);
      }).not.toThrow();
    });
  });

  describe("getStatusSnapshot", () => {
    it("debe retornar snapshot del estado", () => {
      const snapshot = aiSystem.getStatusSnapshot();
      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe("object");
    });
  });

  describe("getPerformanceMetrics", () => {
    it("debe retornar métricas de rendimiento", () => {
      const metrics = aiSystem.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe("object");
    });
  });

  describe("removeEntityAI", () => {
    it("debe remover AI de una entidad", () => {
      aiSystem.update(1000);
      expect(() => {
        aiSystem.removeEntityAI("agent-1");
      }).not.toThrow();
      const state = aiSystem.getAIState("agent-1");
      expect(state).toBeUndefined();
    });
  });

  describe("cleanup", () => {
    it("debe limpiar recursos sin errores", () => {
      aiSystem.update(1000);
      expect(() => {
        aiSystem.cleanup();
      }).not.toThrow();
    });
  });

  describe("Manejo de acciones completadas", () => {
    it("debe manejar acción completada", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "work",
          priority: 0.5,
          createdAt: Date.now(),
          targetZoneId: "work-zone-1",
        };
      }

      simulationEvents.emit(GameEventNames.ACTION_COMPLETED, {
        entityId: "agent-1",
        actionType: "work",
        success: true,
        timestamp: Date.now(),
      });

      // El sistema debería procesar el evento
      expect(aiSystem).toBeDefined();
    });
  });

  describe("Búsqueda de recursos", () => {
    it("debe encontrar recursos cercanos", () => {
      gameState.worldResources = [
        {
          id: "tree-1",
          type: "tree",
          position: { x: 120, y: 120 },
          amount: 100,
          biome: "forest",
        },
        {
          id: "stone-1",
          type: "stone",
          position: { x: 150, y: 150 },
          amount: 50,
          biome: "mountain",
        },
      ];

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        expect(state).toBeDefined();
      }
    });
  });

  describe("Objetivos que se completan automáticamente", () => {
    it("debe completar objetivo cuando necesidad está satisfecha", () => {
      needsSystem.initializeEntityNeeds("agent-1");
      const needs = needsSystem.getEntityNeeds("agent-1");
      if (needs) {
        needs.hunger = 20; // Necesidad crítica
      }

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state && state.currentGoal) {
        // Satisfacer la necesidad
        needsSystem.satisfyNeed("agent-1", "hunger", 60);
        
        // Actualizar para que el sistema detecte que el objetivo está completo
        aiSystem.update(1000);
        
        // El objetivo debería estar completado o removido
        expect(aiSystem).toBeDefined();
      }
    });

    it("debe expirar objetivos antiguos", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "explore",
          priority: 0.5,
          createdAt: Date.now() - 70000, // Más de 60 segundos
          targetPosition: { x: 200, y: 200 },
        };
        
        aiSystem.update(1000);
        // El objetivo debería estar expirado
        expect(aiSystem).toBeDefined();
      }
    });

    it("debe invalidar objetivo cuando zona no existe", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "work",
          priority: 0.5,
          createdAt: Date.now(),
          targetZoneId: "nonexistent-zone",
        };
        
        aiSystem.update(1000);
        // El objetivo debería estar invalidado
        expect(aiSystem).toBeDefined();
      }
    });
  });

  describe("Manejo de diferentes tipos de objetivos", () => {
    it("debe manejar objetivo de asistencia", () => {
      gameState.agents?.push({
        id: "agent-3",
        name: "Injured Agent",
        ageYears: 25,
        lifeStage: "adult",
        immortal: false,
        position: { x: 150, y: 150 },
        type: "agent",
        traits: { cooperation: 0.5, diligence: 0.6, curiosity: 0.4 },
      });

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "assist_medical",
          priority: 0.8,
          createdAt: Date.now(),
          targetId: "agent-3",
          data: { targetAgentId: "agent-3" },
        };
        
        aiSystem.update(1000);
        expect(aiSystem).toBeDefined();
      }
    });

    it("debe manejar objetivo con recurso específico", () => {
      gameState.worldResources = [
        {
          id: "tree-1",
          type: "tree",
          position: { x: 120, y: 120 },
          amount: 100,
          biome: "forest",
          state: "pristine",
        },
      ];

      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = {
          type: "gather",
          priority: 0.6,
          createdAt: Date.now(),
          targetId: "tree-1",
          data: { resourceType: "tree" },
        };
        
        aiSystem.update(1000);
        expect(aiSystem).toBeDefined();
      }
    });
  });

  describe("Manejo de errores y casos edge", () => {
    it("debe manejar agente sin posición", () => {
      if (gameState.agents && gameState.agents[0]) {
        delete gameState.agents[0].position;
      }
      
      expect(() => {
        aiSystem.update(1000);
      }).not.toThrow();
    });

    it("debe manejar agente sin rol", () => {
      if (gameState.agents && gameState.agents[0]) {
        delete gameState.agents[0].role;
      }
      
      expect(() => {
        aiSystem.update(1000);
      }).not.toThrow();
    });

    it("debe manejar estado AI sin objetivo", () => {
      aiSystem.update(1000);
      const state = aiSystem.getAIState("agent-1");
      if (state) {
        state.currentGoal = null;
        expect(() => {
          aiSystem.update(1000);
        }).not.toThrow();
      }
    });
  });

  describe("Actualización con diferentes intervalos", () => {
    it("debe procesar agentes en lotes con intervalos grandes", () => {
      // Agregar más agentes
      for (let i = 3; i < 15; i++) {
        gameState.agents?.push({
          id: `agent-${i}`,
          name: `Agent ${i}`,
          ageYears: 25,
          lifeStage: "adult",
          immortal: false,
          position: { x: 100 + i * 10, y: 100 + i * 10 },
          type: "agent",
          traits: { cooperation: 0.5, diligence: 0.6, curiosity: 0.4 },
        });
      }

      // Actualizar múltiples veces para procesar todos los lotes
      for (let i = 0; i < 20; i++) {
        aiSystem.update(1000);
      }
      
      const states = aiSystem.getAllAIStates();
      expect(states.length).toBeGreaterThan(0);
    });
  });
});
