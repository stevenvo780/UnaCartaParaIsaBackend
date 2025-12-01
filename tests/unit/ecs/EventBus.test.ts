/**
 * @fileoverview Tests para EventBus ECS
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/domain/simulation/ecs";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({ debug: false });
  });

  describe("emit and on", () => {
    it("should call handler when event is emitted", () => {
      const handler = vi.fn();
      eventBus.on("combat:damage_dealt", handler);

      eventBus.emit("combat:damage_dealt", {
        attackerId: "attacker-1",
        targetId: "target-1",
        damage: 10,
        damageType: "physical",
        timestamp: Date.now(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          attackerId: "attacker-1",
          targetId: "target-1",
          damage: 10,
        }),
      );
    });

    it("should call multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("needs:critical", handler1);
      eventBus.on("needs:critical", handler2);

      eventBus.emit("needs:critical", {
        agentId: "agent-1",
        needType: "hunger",
        value: 10,
        threshold: 20,
        timestamp: Date.now(),
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("off", () => {
    it("should remove handler", () => {
      const handler = vi.fn();
      eventBus.on("movement:arrived", handler);
      eventBus.off("movement:arrived", handler);

      eventBus.emit("movement:arrived", {
        agentId: "agent-1",
        position: { x: 10, y: 20 },
        timestamp: Date.now(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    it("should call handler only once", () => {
      const handler = vi.fn();
      eventBus.once("inventory:item_added", handler);

      eventBus.emit("inventory:item_added", {
        agentId: "agent-1",
        itemId: "item-1",
        itemType: "food",
        quantity: 1,
        timestamp: Date.now(),
      });

      eventBus.emit("inventory:item_added", {
        agentId: "agent-1",
        itemId: "item-2",
        itemType: "wood",
        quantity: 5,
        timestamp: Date.now(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear", () => {
    it("should remove all handlers for an event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("social:interaction", handler1);
      eventBus.on("social:interaction", handler2);
      eventBus.clear("social:interaction");

      eventBus.emit("social:interaction", {
        agentId: "agent-1",
        targetId: "agent-2",
        interactionType: "greeting",
        outcome: "positive",
        timestamp: Date.now(),
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("stats", () => {
    it("should track event statistics", () => {
      eventBus.on("ai:task_started", vi.fn());

      eventBus.emit("ai:task_started", {
        agentId: "agent-1",
        taskType: "gather",
        taskId: "task-1",
        priority: 0.5,
        timestamp: Date.now(),
      });

      eventBus.emit("ai:task_started", {
        agentId: "agent-2",
        taskType: "rest",
        taskId: "task-2",
        priority: 0.8,
        timestamp: Date.now(),
      });

      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBe(2);
    });
  });
});
