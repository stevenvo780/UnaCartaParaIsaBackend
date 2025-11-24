import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeNetworkSystem } from "../../src/domain/simulation/systems/KnowledgeNetworkSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";
import { vi } from "vitest";

describe("KnowledgeNetworkSystem", () => {
  let gameState: GameState;
  let knowledgeSystem: KnowledgeNetworkSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent",
          position: { x: 100, y: 100 },
          ageYears: 25,
          lifeStage: "adult",
          sex: "female",
          generation: 0,
          birthTimestamp: Date.now(),
          immortal: false,
          traits: {},
          socialStatus: "commoner",
        },
        {
          id: "agent-2",
          name: "Test Agent 2",
          position: { x: 200, y: 200 },
          ageYears: 30,
          lifeStage: "adult",
          sex: "male",
          generation: 0,
          birthTimestamp: Date.now(),
          immortal: false,
          traits: {},
          socialStatus: "commoner",
        },
      ],
    });

    knowledgeSystem = new KnowledgeNetworkSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(knowledgeSystem).toBeDefined();
    });
  });

  describe("Agregar conocimiento", () => {
    it("debe agregar un nodo de conocimiento", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      const snapshot = knowledgeSystem.getGraphSnapshot();
      expect(snapshot.nodes.length).toBeGreaterThan(0);
      expect(snapshot.nodes.find((n) => n.id === "fact-1")).toBeDefined();
    });

    it("debe agregar un nodo de receta", () => {
      knowledgeSystem.addKnowledge(
        "recipe-1",
        "recipe",
        {
          type: "recipe",
          recipeId: "wooden_tool",
          ingredients: ["wood", "stone"],
        },
        "agent-1",
      );

      const snapshot = knowledgeSystem.getGraphSnapshot();
      const recipeNode = snapshot.nodes.find((n) => n.id === "recipe-1");
      expect(recipeNode).toBeDefined();
      expect(recipeNode?.type).toBe("recipe");
    });

    it("debe agregar un nodo de ubicación", () => {
      knowledgeSystem.addKnowledge(
        "location-1",
        "location",
        {
          type: "location",
          x: 500,
          y: 500,
          zoneId: "zone-1",
        },
        "agent-1",
      );

      const snapshot = knowledgeSystem.getGraphSnapshot();
      const locationNode = snapshot.nodes.find((n) => n.id === "location-1");
      expect(locationNode).toBeDefined();
      expect(locationNode?.type).toBe("location");
    });

    it("no debe duplicar nodos existentes", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-2",
      );

      const snapshot = knowledgeSystem.getGraphSnapshot();
      const factNodes = snapshot.nodes.filter((n) => n.id === "fact-1");
      expect(factNodes.length).toBe(1);
    });
  });

  describe("Aprender conocimiento", () => {
    it("debe permitir que un agente aprenda conocimiento", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
      );

      const learned = knowledgeSystem.learnKnowledge("agent-1", "fact-1");
      expect(learned).toBe(true);

      const agentKnowledge = knowledgeSystem.getAgentKnowledge("agent-1");
      expect(agentKnowledge?.has("fact-1")).toBe(true);
    });

    it("debe emitir evento cuando se aprende conocimiento", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");

      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
      );

      knowledgeSystem.learnKnowledge("agent-1", "fact-1");

      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.KNOWLEDGE_LEARNED,
        expect.objectContaining({
          agentId: "agent-1",
          nodeId: "fact-1",
        }),
      );
    });

    it("debe retornar false si el nodo no existe", () => {
      const learned = knowledgeSystem.learnKnowledge("agent-1", "non-existent");
      expect(learned).toBe(false);
    });
  });

  describe("Compartir conocimiento", () => {
    it("debe permitir compartir conocimiento entre agentes", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      knowledgeSystem.learnKnowledge("agent-1", "fact-1");

      const shared = knowledgeSystem.shareKnowledge("agent-1", "agent-2", "fact-1");
      expect(shared).toBe(true);

      const agent2Knowledge = knowledgeSystem.getAgentKnowledge("agent-2");
      expect(agent2Knowledge?.has("fact-1")).toBe(true);
    });

    it("debe emitir evento cuando se comparte conocimiento", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");

      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      knowledgeSystem.learnKnowledge("agent-1", "fact-1");
      knowledgeSystem.shareKnowledge("agent-1", "agent-2", "fact-1");

      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.KNOWLEDGE_SHARED,
        expect.objectContaining({
          fromAgentId: "agent-1",
          toAgentId: "agent-2",
          nodeId: "fact-1",
        }),
      );
    });

    it("debe retornar false si el agente no tiene el conocimiento", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
      );

      const shared = knowledgeSystem.shareKnowledge("agent-1", "agent-2", "fact-1");
      expect(shared).toBe(false);
    });
  });

  describe("Obtener conocimiento del agente", () => {
    it("debe retornar el conocimiento de un agente", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
      );
      knowledgeSystem.learnKnowledge("agent-1", "fact-1");

      const knowledge = knowledgeSystem.getAgentKnowledge("agent-1");
      expect(knowledge).toBeDefined();
      expect(knowledge?.has("fact-1")).toBe(true);
    });

    it("debe retornar undefined para agente sin conocimiento", () => {
      const knowledge = knowledgeSystem.getAgentKnowledge("non-existent");
      expect(knowledge).toBeUndefined();
    });
  });

  describe("Snapshot del grafo", () => {
    it("debe generar un snapshot del grafo", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      const snapshot = knowledgeSystem.getGraphSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.nodes).toBeDefined();
      expect(snapshot.edges).toBeDefined();
      expect(Array.isArray(snapshot.nodes)).toBe(true);
      expect(Array.isArray(snapshot.edges)).toBe(true);
    });
  });

  describe("Actualización", () => {
    it("debe actualizar el estado del juego con el grafo", () => {
      knowledgeSystem.addKnowledge(
        "fact-1",
        "fact",
        { type: "fact", content: "El fuego quema" },
        "agent-1",
      );

      knowledgeSystem.update(100);

      expect(gameState.knowledgeGraph).toBeDefined();
      expect(gameState.knowledgeGraph?.nodes.length).toBeGreaterThan(0);
    });
  });
});

