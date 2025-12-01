import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import { WorldResourceSystem } from "../../src/domain/simulation/systems/world/WorldResourceSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

const mockGetResourceConfig = vi.fn();
vi.mock("../../src/domain/simulation/systems/world/config/WorldResourceConfigs", () => ({
  getResourceConfig: (type: string) => mockGetResourceConfig(type),
}));

const baseConfig = {
  spawnProbability: 1,
  suitableBiomes: ["forest"],
  harvestsUntilDepleted: 2,
  harvestsUntilPartial: 1,
  canRegenerate: true,
  regenerationTime: 1000,
};

describe("WorldResourceSystem", () => {
  let gameState: GameState;
  let resourceSystem: WorldResourceSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mockGetResourceConfig.mockImplementation((type: string) => ({
      ...baseConfig,
      type,
    }));
    gameState = createMockGameState();
    resourceSystem = new WorldResourceSystem(gameState);
    emitSpy = vi.spyOn(simulationEvents, "emit");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("spawnResource agrega recursos y emite RESOURCE_SPAWNED", () => {
    const resource = resourceSystem.spawnResource("tree", { x: 0, y: 0 }, "forest");
    expect(resource).not.toBeNull();
    expect(Object.keys(gameState.worldResources || {})).toContain(resource!.id);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.RESOURCE_SPAWNED,
      expect.objectContaining({ resource }),
    );
  });

  it("harvestResource cambia estado y programa regeneración tras múltiples cosechas", () => {
    const resource = resourceSystem.spawnResource("tree", { x: 0, y: 0 }, "forest");
    emitSpy.mockClear();

    resourceSystem.harvestResource(resource!.id, "agent-1");
    const result = resourceSystem.harvestResource(resource!.id, "agent-1");
    expect(result.success).toBe(true);
    expect(resource!.state).toBe("depleted");
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.RESOURCE_STATE_CHANGE,
      expect.objectContaining({ resourceId: resource!.id, newState: "depleted" }),
    );
  });

  it("update regenera recursos después del tiempo configurado", () => {
    const resource = resourceSystem.spawnResource("tree", { x: 0, y: 0 }, "forest");
    resourceSystem.harvestResource(resource!.id, "agent-1");
    resourceSystem.harvestResource(resource!.id, "agent-1");
    emitSpy.mockClear();

    // The actual regeneration time is hardcoded to 60000ms in checkRegeneration
    vi.setSystemTime(70000);
    resourceSystem.update(0);

    expect(resource!.state).toBe("pristine");
    expect(resource!.harvestCount).toBe(0);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.RESOURCE_STATE_CHANGE,
      expect.objectContaining({ resourceId: resource!.id, newState: "pristine" }),
    );
  });
});
