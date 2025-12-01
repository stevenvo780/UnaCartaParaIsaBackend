/**
 * @fileoverview Tests for TaskQueue
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskQueue } from "../../../src/domain/simulation/systems/agents/ai/TaskQueue";
import {
  type AgentTask,
  TaskType,
  TaskStatus,
  createTask,
} from "../../../src/shared/types/simulation/unifiedTasks";

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe("enqueue", () => {
    it("should add a task for an agent", () => {
      const task = createTask({ type: TaskType.GATHER, priority: 0.5 });
      queue.enqueue("agent_1", task);

      const retrieved = queue.peek("agent_1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe(TaskType.GATHER);
    });

    it("should sort tasks by priority (highest first)", () => {
      const lowPriority = createTask({ type: TaskType.IDLE, priority: 0.2 });
      const highPriority = createTask({
        type: TaskType.SATISFY_NEED,
        priority: 0.9,
      });
      const medPriority = createTask({ type: TaskType.GATHER, priority: 0.5 });

      queue.enqueue("agent_1", lowPriority);
      queue.enqueue("agent_1", highPriority);
      queue.enqueue("agent_1", medPriority);

      const first = queue.peek("agent_1");
      expect(first?.priority).toBe(0.9);
      expect(first?.type).toBe(TaskType.SATISFY_NEED);
    });

    it("should maintain separate queues per agent", () => {
      const task1 = createTask({ type: TaskType.GATHER, priority: 0.5 });
      const task2 = createTask({ type: TaskType.REST, priority: 0.8 });

      queue.enqueue("agent_1", task1);
      queue.enqueue("agent_2", task2);

      expect(queue.peek("agent_1")?.type).toBe(TaskType.GATHER);
      expect(queue.peek("agent_2")?.type).toBe(TaskType.REST);
    });
  });

  describe("dequeue", () => {
    it("should remove and return the highest priority task", () => {
      const task1 = createTask({ type: TaskType.IDLE, priority: 0.2 });
      const task2 = createTask({ type: TaskType.GATHER, priority: 0.7 });

      queue.enqueue("agent_1", task1);
      queue.enqueue("agent_1", task2);

      const dequeued = queue.dequeue("agent_1");
      expect(dequeued?.type).toBe(TaskType.GATHER);

      const next = queue.peek("agent_1");
      expect(next?.type).toBe(TaskType.IDLE);
    });

    it("should return null for empty queue", () => {
      expect(queue.dequeue("agent_1")).toBeNull();
    });
  });

  describe("peek", () => {
    it("should return the highest priority task without removing it", () => {
      const task = createTask({ type: TaskType.GATHER, priority: 0.5 });
      queue.enqueue("agent_1", task);

      const peeked1 = queue.peek("agent_1");
      const peeked2 = queue.peek("agent_1");

      expect(peeked1).toBe(peeked2);
      expect(queue.getTaskCount("agent_1")).toBe(1);
    });

    it("should return null for empty queue", () => {
      expect(queue.peek("agent_1")).toBeNull();
    });
  });

  describe("clear", () => {
    it("should remove all tasks for an agent", () => {
      queue.enqueue("agent_1", createTask({ type: TaskType.GATHER }));
      queue.enqueue("agent_1", createTask({ type: TaskType.REST }));
      queue.enqueue("agent_2", createTask({ type: TaskType.IDLE }));

      queue.clear("agent_1");

      expect(queue.getTaskCount("agent_1")).toBe(0);
      expect(queue.getTaskCount("agent_2")).toBe(1);
    });
  });

  describe("getTaskCount", () => {
    it("should return 0 for unknown agents", () => {
      expect(queue.getTaskCount("unknown")).toBe(0);
    });

    it("should return correct task count", () => {
      queue.enqueue("agent_1", createTask({ type: TaskType.GATHER }));
      queue.enqueue("agent_1", createTask({ type: TaskType.REST }));

      expect(queue.getTaskCount("agent_1")).toBe(2);
    });
  });

  describe("cleanExpired", () => {
    it("should remove tasks past their expiration", () => {
      const expiredTask = createTask({ type: TaskType.GATHER, priority: 0.5 });
      expiredTask.expiresAt = Date.now() - 1000; // Already expired

      const validTask = createTask({ type: TaskType.REST, priority: 0.3 });
      validTask.expiresAt = Date.now() + 60000; // Not expired

      queue.enqueue("agent_1", expiredTask);
      queue.enqueue("agent_1", validTask);

      queue.cleanExpired("agent_1");

      expect(queue.getTaskCount("agent_1")).toBe(1);
      expect(queue.peek("agent_1")?.type).toBe(TaskType.REST);
    });

    it("should keep tasks without expiration", () => {
      const task = createTask({ type: TaskType.GATHER });
      // No expiresAt set
      queue.enqueue("agent_1", task);

      queue.cleanExpired("agent_1");

      expect(queue.getTaskCount("agent_1")).toBe(1);
    });
  });

  describe("hasTasks", () => {
    it("should return true if agent has tasks", () => {
      const task = createTask({ type: TaskType.GATHER });
      queue.enqueue("agent_1", task);

      expect(queue.hasTasks("agent_1")).toBe(true);
    });

    it("should return false for empty queue", () => {
      expect(queue.hasTasks("agent_1")).toBe(false);
    });
  });

  describe("getTasks", () => {
    it("should return all tasks for an agent", () => {
      queue.enqueue("agent_1", createTask({ type: TaskType.GATHER }));
      queue.enqueue("agent_1", createTask({ type: TaskType.REST }));
      queue.enqueue("agent_2", createTask({ type: TaskType.IDLE }));

      const tasks = queue.getTasks("agent_1");

      expect(tasks).toHaveLength(2);
    });

    it("should return empty array for unknown agent", () => {
      expect(queue.getTasks("unknown")).toEqual([]);
    });
  });

  describe("completeTask", () => {
    it("should mark task as completed", () => {
      const task = createTask({ type: TaskType.GATHER });
      queue.enqueue("agent_1", task);

      const result = queue.completeTask("agent_1", task.id);

      expect(result).toBe(true);
      expect(queue.getTasks("agent_1")[0].status).toBe(TaskStatus.COMPLETED);
    });

    it("should return false for non-existent task", () => {
      expect(queue.completeTask("agent_1", "nonexistent")).toBe(false);
    });
  });

  describe("failTask", () => {
    it("should mark task as failed", () => {
      const task = createTask({ type: TaskType.GATHER });
      queue.enqueue("agent_1", task);

      const result = queue.failTask("agent_1", task.id);

      expect(result).toBe(true);
      expect(queue.getTasks("agent_1")[0].status).toBe(TaskStatus.FAILED);
    });
  });

  describe("removeTask", () => {
    it("should remove a specific task by ID", () => {
      const task1 = createTask({ type: TaskType.GATHER });
      const task2 = createTask({ type: TaskType.REST });
      queue.enqueue("agent_1", task1);
      queue.enqueue("agent_1", task2);

      const result = queue.removeTask("agent_1", task1.id);

      expect(result).toBe(true);
      expect(queue.getTaskCount("agent_1")).toBe(1);
      expect(queue.getTasks("agent_1")[0].type).toBe(TaskType.REST);
    });
  });
});
