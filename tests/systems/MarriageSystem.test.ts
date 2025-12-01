import { describe, it, expect, beforeEach } from "vitest";
import { MarriageSystem } from "../../src/domain/simulation/systems/social/MarriageSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("MarriageSystem", () => {
  let gameState: GameState;
  let marriageSystem: MarriageSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    marriageSystem = new MarriageSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(marriageSystem).toBeDefined();
    });
  });

  describe("Propuestas de matrimonio", () => {
    it("debe crear propuesta de matrimonio", () => {
      const proposed = marriageSystem.proposeMarriage("proposer-1", "target-1");
      expect(proposed).toBe(true);
    });

    it("debe aceptar propuesta", () => {
      marriageSystem.proposeMarriage("proposer-1", "target-1");
      const result = marriageSystem.acceptProposal("target-1");
      expect(result.success).toBe(true);
      expect(result.groupId).toBeDefined();
    });

    it("debe rechazar propuesta", () => {
      marriageSystem.proposeMarriage("proposer-1", "target-1");
      const rejected = marriageSystem.rejectProposal("target-1");
      expect(rejected).toBe(true);
    });
  });

  describe("Gestión de grupos", () => {
    it("debe obtener grupos de matrimonio", () => {
      marriageSystem.proposeMarriage("proposer-1", "target-1");
      marriageSystem.acceptProposal("target-1");
      
      const groups = marriageSystem.getAllMarriageGroups();
      expect(groups.length).toBeGreaterThan(0);
    });

    it("debe obtener grupo por ID", () => {
      marriageSystem.proposeMarriage("proposer-1", "target-1");
      const result = marriageSystem.acceptProposal("target-1");
      
      if (result.groupId) {
        const group = marriageSystem.getMarriageGroup(result.groupId);
        expect(group).toBeDefined();
      }
    });
  });

  describe("Divorcio", () => {
    it("debe iniciar divorcio", () => {
      marriageSystem.proposeMarriage("proposer-1", "target-1");
      const result = marriageSystem.acceptProposal("target-1");
      
      if (result.groupId) {
        const divorced = marriageSystem.initiateDivorce("proposer-1", result.groupId);
        expect(divorced).toBe(true);
      }
    });
  });

  describe("Estadísticas", () => {
    it("debe retornar estadísticas", () => {
      const stats = marriageSystem.getMarriageStats();
      expect(stats).toBeDefined();
      expect(stats.totalMarriages).toBeDefined();
      expect(stats.totalMembers).toBeDefined();
    });
  });
});

