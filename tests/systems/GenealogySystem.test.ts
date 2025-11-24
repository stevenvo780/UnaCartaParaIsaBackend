import { describe, it, expect, beforeEach } from "vitest";
import { GenealogySystem } from "../../src/simulation/systems/GenealogySystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";
import type { AgentProfile } from "../../src/simulation/types/agents.js";

describe("GenealogySystem", () => {
  let gameState: GameState;
  let genealogySystem: GenealogySystem;

  beforeEach(() => {
    gameState = createMockGameState();
    genealogySystem = new GenealogySystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(genealogySystem).toBeDefined();
    });
  });

  describe("Registro de nacimientos", () => {
    it("debe registrar nacimiento", () => {
      const agent: AgentProfile = {
        id: "agent-1",
        name: "Test Agent",
        sex: "male",
        ageYears: 0,
        lifeStage: "child",
        birthTimestamp: Date.now(),
        generation: 0,
        immortal: false,
        traits: {},
      };
      
      expect(() => genealogySystem.registerBirth(agent)).not.toThrow();
    });

    it("debe registrar nacimiento con padres", () => {
      const father: AgentProfile = {
        id: "father-1",
        name: "Father",
        sex: "male",
        ageYears: 30,
        lifeStage: "adult",
        birthTimestamp: Date.now(),
        generation: 0,
        immortal: false,
        traits: {},
      };
      
      genealogySystem.registerBirth(father);
      
      const child: AgentProfile = {
        id: "child-1",
        name: "Child",
        sex: "male",
        ageYears: 0,
        lifeStage: "child",
        birthTimestamp: Date.now(),
        generation: 1,
        immortal: false,
        traits: {},
      };
      
      expect(() => genealogySystem.registerBirth(child, "father-1")).not.toThrow();
    });
  });
});

