import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "inversify";
import { TYPES } from "../../src/config/Types";
import { TaskSystem } from "../../src/domain/simulation/systems/TaskSystem";
import { GameState } from "../../src/domain/types/game-types";
import { createMockGameState } from "../setup";

describe("Work History Tracking", () => {
  let container: Container;
  let taskSystem: TaskSystem;
  let gameState: GameState;

  beforeEach(() => {
    container = new Container();
    gameState = createMockGameState();

    container.bind(TYPES.GameState).toConstantValue(gameState);

    taskSystem = new TaskSystem(gameState);
  });

  it("should record work history when a task is completed", () => {
    const agentId = "agent-1";
    const task = taskSystem.createTask({
      type: "build",
      zoneId: "zone-1",
      requiredWork: 10,
      requirements: { minWorkers: 1 }
    });

    expect(task).not.toBeNull();
    if (!task) return;

    // Contribute until completion
    taskSystem.contributeToTask(task.id, agentId, 10);

    const history = taskSystem.getWorkHistory(agentId);
    expect(history).toHaveLength(1);
    expect(history[0].taskId).toBe(task.id);
    expect(history[0].taskType).toBe("build");
    expect(history[0].contribution).toBe(10);
  });

  it("should limit work history to 10 entries", () => {
    const agentId = "worker-1";

    for (let i = 0; i < 15; i++) {
      const task = taskSystem.createTask({
        type: `job-${i}`,
        zoneId: "zone-1",
        requiredWork: 10,
        requirements: { minWorkers: 1 }
      });

      if (task) {
        taskSystem.contributeToTask(task.id, agentId, 10);
      }
    }

    const history = taskSystem.getWorkHistory(agentId);
    expect(history).toHaveLength(10);
    expect(history[0].taskType).toBe("job-14");
    expect(history[9].taskType).toBe("job-5");
  });

  it("should record contributions from multiple agents", () => {
    const agent1 = "worker-1";
    const agent2 = "worker-2";

    const task = taskSystem.createTask({
      type: "collaborative-build",
      zoneId: "zone-1",
      requiredWork: 20,
      requirements: { minWorkers: 1 }
    });

    if (!task) return;

    taskSystem.contributeToTask(task.id, agent1, 10);
    taskSystem.contributeToTask(task.id, agent2, 10); // Completes it

    const history1 = taskSystem.getWorkHistory(agent1);
    const history2 = taskSystem.getWorkHistory(agent2);

    expect(history1).toHaveLength(1);
    expect(history1[0].contribution).toBe(10);

    expect(history2).toHaveLength(1);
    expect(history2[0].contribution).toBe(10);
  });
});
