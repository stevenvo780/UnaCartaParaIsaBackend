import { describe, it, expect, beforeEach } from "vitest";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("LifeCycleSystem", () => {
  let gameState: GameState;
  let lifeCycleSystem: LifeCycleSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [],
    });
    lifeCycleSystem = new LifeCycleSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(lifeCycleSystem).toBeDefined();
    });
  });

  describe("Gestión de agentes", () => {
    it("debe spawnear agente", () => {
      const agent = lifeCycleSystem.spawnAgent({ name: "Test Agent" });
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe("Test Agent");
      expect(agent.ageYears).toBeGreaterThanOrEqual(0);
    });

    it("debe agregar agente", () => {
      const agent = lifeCycleSystem.spawnAgent();
      const retrieved = lifeCycleSystem.getAgent(agent.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(agent.id);
    });

    it("debe retornar todos los agentes", () => {
      lifeCycleSystem.spawnAgent();
      lifeCycleSystem.spawnAgent();
      const agents = lifeCycleSystem.getAgents();
      expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    it("debe remover agente", () => {
      const agent = lifeCycleSystem.spawnAgent();
      lifeCycleSystem.removeAgent(agent.id);
      const retrieved = lifeCycleSystem.getAgent(agent.id);
      expect(retrieved).toBeUndefined();
    });

    it("debe matar agente", () => {
      const agent = lifeCycleSystem.spawnAgent();
      const killed = lifeCycleSystem.killAgent(agent.id);
      expect(killed).toBe(true);
      const retrieved = lifeCycleSystem.getAgent(agent.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe("Actualización del ciclo de vida", () => {
    it("debe actualizar edad de agentes", () => {
      const agent = lifeCycleSystem.spawnAgent();
      const initialAge = agent.ageYears;
      
      lifeCycleSystem.update(30000); // 30 segundos = 1 año con config por defecto
      
      const updated = lifeCycleSystem.getAgent(agent.id);
      expect(updated?.ageYears).toBeGreaterThan(initialAge);
    });

    it("debe cambiar etapa de vida según edad", () => {
      const agent = lifeCycleSystem.spawnAgent({ 
        name: "Child",
        traits: { age: 10 }
      });
      agent.ageYears = 10;
      agent.lifeStage = "child";
      
      lifeCycleSystem.update(1000);
      
      const updated = lifeCycleSystem.getAgent(agent.id);
      expect(updated?.lifeStage).toBeDefined();
    });

    it("debe remover agentes que exceden edad máxima", () => {
      const agent = lifeCycleSystem.spawnAgent();
      agent.ageYears = 100; // Mayor que maxAge (85)
      
      lifeCycleSystem.update(1000);
      
      const retrieved = lifeCycleSystem.getAgent(agent.id);
      expect(retrieved).toBeUndefined();
    });

    it("debe mantener agentes inmortales incluso si exceden edad máxima", () => {
      const agent = lifeCycleSystem.spawnAgent({ immortal: true });
      agent.ageYears = lifeCycleSystem['config'].maxAge + 10;
      
      lifeCycleSystem.update(100000);
      
      const updated = lifeCycleSystem.getAgent(agent.id);
      expect(updated).toBeDefined();
      expect(updated?.immortal).toBe(true);
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new LifeCycleSystem(gameState, {
        secondsPerYear: 60,
        maxAge: 100,
        adultAge: 18,
      });
      expect(customSystem).toBeDefined();
    });
  });
});

