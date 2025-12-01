import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityIndex } from "../../src/domain/simulation/core/EntityIndex";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/shared/types/game-types";
import type { AgentProfile } from "../../src/shared/types/simulation/agents";
import type { SimulationEntity } from "../../src/domain/simulation/core/schema";

describe("EntityIndex", () => {
  let entityIndex: EntityIndex;
  let gameState: GameState;

  beforeEach(() => {
    entityIndex = new EntityIndex();
    gameState = createMockGameState();
  });

  describe("rebuild", () => {
    it("debe reconstruir completamente cuando dirty", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);

      expect(entityIndex.getAgent("agent-1")).toBeDefined();
      expect(entityIndex.getEntity("entity-1")).toBeDefined();
    });

    it("debe reconstruir incrementalmente con cambios pequeños", () => {
      // Primera reconstrucción completa
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      // Agregar un agente pendiente
      entityIndex.notifyAgentAdded("agent-2");
      gameState.agents = [
        ...gameState.agents!,
        {
          id: "agent-2",
          name: "Agent 2",
          position: { x: 10, y: 10 },
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);

      expect(entityIndex.getAgent("agent-1")).toBeDefined();
      expect(entityIndex.getAgent("agent-2")).toBeDefined();
    });

    it("no debe reconstruir si no hay cambios estructurales", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const agentBefore = entityIndex.getAgent("agent-1");
      entityIndex.rebuild(gameState);
      const agentAfter = entityIndex.getAgent("agent-1");

      expect(agentBefore).toBe(agentAfter); // Misma referencia
    });
  });

  describe("notifyAgentAdded/Removed", () => {
    it("debe trackear cambios pendientes de agentes", () => {
      entityIndex.notifyAgentAdded("agent-1");
      entityIndex.notifyAgentRemoved("agent-2");

      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);

      expect(entityIndex.getAgent("agent-1")).toBeDefined();
      expect(entityIndex.getAgent("agent-2")).toBeUndefined();
    });

    it("debe trackear cambios pendientes de entidades", () => {
      entityIndex.notifyEntityAdded("entity-1");
      entityIndex.notifyEntityRemoved("entity-2");

      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);

      expect(entityIndex.getEntity("entity-1")).toBeDefined();
      expect(entityIndex.getEntity("entity-2")).toBeUndefined();
    });
  });

  describe("syncAgentsToEntities", () => {
    it("debe sincronizar agents con entities", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 100, y: 200 },
          traits: {},
        },
      ];
      gameState.entities = [];

      entityIndex.rebuild(gameState);
      entityIndex.syncAgentsToEntities(gameState);

      expect(gameState.entities).toHaveLength(1);
      expect(gameState.entities![0].id).toBe("agent-1");
      expect(gameState.entities![0].x).toBe(100);
      expect(gameState.entities![0].y).toBe(200);
    });

    it("debe actualizar posición de entity existente", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 100, y: 200 },
          traits: {},
        },
      ];
      gameState.entities = [
        {
          id: "agent-1",
          name: "Agent 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);
      entityIndex.syncAgentsToEntities(gameState);

      expect(gameState.entities![0].x).toBe(100);
      expect(gameState.entities![0].y).toBe(200);
    });

    it("no debe hacer nada si no hay agents", () => {
      gameState.agents = undefined;
      const initialEntities = gameState.entities || [];

      entityIndex.syncAgentsToEntities(gameState);

      expect(gameState.entities).toEqual(initialEntities);
    });
  });

  describe("markDirty", () => {
    it("debe marcar para reconstrucción", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      entityIndex.markDirty();
      gameState.agents = [
        {
          id: "agent-2",
          name: "Agent 2",
          position: { x: 10, y: 10 },
          traits: {},
        },
      ];

      entityIndex.rebuild(gameState);

      expect(entityIndex.getAgent("agent-2")).toBeDefined();
    });
  });

  describe("getAgent/Entity", () => {
    it("debe hacer lookup O(1) de agentes", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const agent = entityIndex.getAgent("agent-1");
      expect(agent).toBeDefined();
      expect(agent?.id).toBe("agent-1");

      const notFound = entityIndex.getAgent("nonexistent");
      expect(notFound).toBeUndefined();
    });

    it("debe hacer lookup O(1) de entidades", () => {
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const entity = entityIndex.getEntity("entity-1");
      expect(entity).toBeDefined();
      expect(entity?.id).toBe("entity-1");

      const notFound = entityIndex.getEntity("nonexistent");
      expect(notFound).toBeUndefined();
    });
  });

  describe("setAgent/Entity", () => {
    it("debe insertar agente en índice", () => {
      const agent: AgentProfile = {
        id: "agent-1",
        name: "Agent 1",
        position: { x: 0, y: 0 },
        traits: {},
      };

      entityIndex.setAgent(agent);

      expect(entityIndex.getAgent("agent-1")).toBe(agent);
    });

    it("debe insertar entidad en índice", () => {
      const entity: SimulationEntity = {
        id: "entity-1",
        name: "Entity 1",
        x: 0,
        y: 0,
        position: { x: 0, y: 0 },
        isDead: false,
        type: "agent",
        traits: {},
      };

      entityIndex.setEntity(entity);

      expect(entityIndex.getEntity("entity-1")).toBe(entity);
    });
  });

  describe("removeAgent/Entity", () => {
    it("debe eliminar agente del índice", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      entityIndex.removeAgent("agent-1");

      expect(entityIndex.getAgent("agent-1")).toBeUndefined();
    });

    it("debe eliminar entidad del índice", () => {
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      entityIndex.removeEntity("entity-1");

      expect(entityIndex.getEntity("entity-1")).toBeUndefined();
    });
  });

  describe("markEntityDead", () => {
    it("debe marcar entidad como muerta y remover de agentIndex", () => {
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      gameState.agents = [
        {
          id: "entity-1",
          name: "Entity 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      entityIndex.markEntityDead("entity-1");

      const entity = entityIndex.getEntity("entity-1");
      expect(entity?.isDead).toBe(true);
      expect(entityIndex.getAgent("entity-1")).toBeUndefined();
    });
  });

  describe("getAllAgents/Entities", () => {
    it("debe retornar iterador de todos los agentes", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
        {
          id: "agent-2",
          name: "Agent 2",
          position: { x: 10, y: 10 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const agents = Array.from(entityIndex.getAllAgents());
      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.id)).toContain("agent-1");
      expect(agents.map((a) => a.id)).toContain("agent-2");
    });

    it("debe retornar iterador de todas las entidades", () => {
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
        {
          id: "entity-2",
          name: "Entity 2",
          x: 10,
          y: 10,
          position: { x: 10, y: 10 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const entities = Array.from(entityIndex.getAllEntities());
      expect(entities).toHaveLength(2);
      expect(entities.map((e) => e.id)).toContain("entity-1");
      expect(entities.map((e) => e.id)).toContain("entity-2");
    });
  });

  describe("hasAgent/Entity", () => {
    it("debe verificar existencia de agente", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      expect(entityIndex.hasAgent("agent-1")).toBe(true);
      expect(entityIndex.hasAgent("nonexistent")).toBe(false);
    });

    it("debe verificar existencia de entidad", () => {
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      expect(entityIndex.hasEntity("entity-1")).toBe(true);
      expect(entityIndex.hasEntity("nonexistent")).toBe(false);
    });
  });

  describe("findEntityOrAgent", () => {
    it("debe buscar tanto en agentes como en entidades", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const result1 = entityIndex.findEntityOrAgent("agent-1");
      expect(result1.agent).toBeDefined();
      expect(result1.entity).toBeUndefined();

      const result2 = entityIndex.findEntityOrAgent("entity-1");
      expect(result2.entity).toBeDefined();
      expect(result2.agent).toBeUndefined();
    });
  });

  describe("getOrCreateEntityFromAgent", () => {
    it("debe retornar entity existente", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
      ];
      gameState.entities = [
        {
          id: "agent-1",
          name: "Agent 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      const entity = entityIndex.getOrCreateEntityFromAgent("agent-1", gameState);
      expect(entity).toBeDefined();
      expect(entity?.id).toBe("agent-1");
    });

    it("debe crear entity si no existe", () => {
      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 100, y: 200 },
          traits: {},
        },
      ];
      gameState.entities = [];
      entityIndex.rebuild(gameState);

      const entity = entityIndex.getOrCreateEntityFromAgent("agent-1", gameState);
      expect(entity).toBeDefined();
      expect(entity?.id).toBe("agent-1");
      expect(entity?.x).toBe(100);
      expect(entity?.y).toBe(200);
      expect(gameState.entities).toHaveLength(1);
    });

    it("debe retornar undefined si agente no existe", () => {
      const entity = entityIndex.getOrCreateEntityFromAgent("nonexistent", gameState);
      expect(entity).toBeUndefined();
    });
  });

  describe("getAgentCount/getEntityCount", () => {
    it("debe retornar conteo correcto de agentes", () => {
      expect(entityIndex.getAgentCount()).toBe(0);

      gameState.agents = [
        {
          id: "agent-1",
          name: "Agent 1",
          position: { x: 0, y: 0 },
          traits: {},
        },
        {
          id: "agent-2",
          name: "Agent 2",
          position: { x: 10, y: 10 },
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      expect(entityIndex.getAgentCount()).toBe(2);
    });

    it("debe retornar conteo correcto de entidades", () => {
      expect(entityIndex.getEntityCount()).toBe(0);

      gameState.entities = [
        {
          id: "entity-1",
          name: "Entity 1",
          x: 0,
          y: 0,
          position: { x: 0, y: 0 },
          isDead: false,
          type: "agent",
          traits: {},
        },
      ];
      entityIndex.rebuild(gameState);

      expect(entityIndex.getEntityCount()).toBe(1);
    });
  });
});

