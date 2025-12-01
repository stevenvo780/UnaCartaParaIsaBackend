/**
 * @fileoverview Tests para AgentStore ECS
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AgentStore,
  createDefaultComponents,
} from "../../../src/domain/simulation/ecs";

describe("AgentStore", () => {
  let store: AgentStore;

  beforeEach(() => {
    store = new AgentStore({ debug: false });
  });

  describe("registerAgent", () => {
    it("should register a new agent with components", () => {
      const components = createDefaultComponents("agent-1", "Test Agent", {
        x: 10,
        y: 20,
      });
      store.registerAgent("agent-1", components);

      expect(store.hasAgent("agent-1")).toBe(true);
    });

    it("should not overwrite existing agent", () => {
      const components1 = createDefaultComponents("agent-1", "First", {
        x: 0,
        y: 0,
      });
      const components2 = createDefaultComponents("agent-1", "Second", {
        x: 100,
        y: 100,
      });

      store.registerAgent("agent-1", components1);
      store.registerAgent("agent-1", components2);

      const profile = store.getProfile("agent-1");
      expect(profile?.name).toBe("First");
    });
  });

  describe("getComponent", () => {
    it("should return component by type", () => {
      const components = createDefaultComponents("agent-1", "Test", {
        x: 5,
        y: 10,
      });
      store.registerAgent("agent-1", components);

      const health = store.getHealth("agent-1");
      expect(health).toBeDefined();
      expect(health?.current).toBe(100);
    });

    it("should return undefined for non-existent agent", () => {
      const health = store.getHealth("non-existent");
      expect(health).toBeUndefined();
    });
  });

  describe("setComponent", () => {
    it("should update component", () => {
      const components = createDefaultComponents("agent-1", "Test", {
        x: 0,
        y: 0,
      });
      store.registerAgent("agent-1", components);

      store.setHealth("agent-1", { current: 50, max: 100 });

      const health = store.getHealth("agent-1");
      expect(health?.current).toBe(50);
    });
  });

  describe("removeAgent", () => {
    it("should remove agent and all components", () => {
      const components = createDefaultComponents("agent-1", "Test", {
        x: 0,
        y: 0,
      });
      store.registerAgent("agent-1", components);
      store.removeAgent("agent-1");

      expect(store.hasAgent("agent-1")).toBe(false);
      expect(store.getHealth("agent-1")).toBeUndefined();
    });
  });

  describe("queries", () => {
    beforeEach(() => {
      // Register multiple agents with different states
      const agent1 = createDefaultComponents("agent-1", "Combatant", {
        x: 0,
        y: 0,
      });
      agent1.combat = {
        isInCombat: true,
        targetId: "enemy-1",
        lastAttackTime: 0,
        damage: 10,
        attackRange: 1,
        attackSpeed: 1,
      };
      store.registerAgent("agent-1", agent1);

      const agent2 = createDefaultComponents("agent-2", "Pacifist", {
        x: 10,
        y: 10,
      });
      agent2.combat = {
        isInCombat: false,
        lastAttackTime: 0,
        damage: 5,
        attackRange: 1,
        attackSpeed: 1,
      };
      store.registerAgent("agent-2", agent2);

      const agent3 = createDefaultComponents("agent-3", "Another Fighter", {
        x: 20,
        y: 20,
      });
      agent3.combat = {
        isInCombat: true,
        targetId: "enemy-2",
        lastAttackTime: 0,
        damage: 15,
        attackRange: 2,
        attackSpeed: 0.8,
      };
      store.registerAgent("agent-3", agent3);
    });

    it("should query agents in combat", () => {
      const inCombat = store.getAgentsInCombat();
      expect(inCombat).toHaveLength(2);
      expect(inCombat).toContain("agent-1");
      expect(inCombat).toContain("agent-3");
      expect(inCombat).not.toContain("agent-2");
    });

    it("should query all agent IDs", () => {
      const allIds = store.getAllAgentIds();
      expect(allIds).toHaveLength(3);
    });
  });

  describe("stats", () => {
    it("should return correct stats", () => {
      store.registerAgent(
        "agent-1",
        createDefaultComponents("agent-1", "A", { x: 0, y: 0 }),
      );
      store.registerAgent(
        "agent-2",
        createDefaultComponents("agent-2", "B", { x: 0, y: 0 }),
      );

      const stats = store.getStats();
      expect(stats.totalAgents).toBe(2);
    });
  });
});
