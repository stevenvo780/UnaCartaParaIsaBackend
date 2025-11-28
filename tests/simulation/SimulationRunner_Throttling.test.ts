import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { container } from "../../src/config/container";
import { TYPES } from "../../src/config/Types";
import { SimulationRunner } from "../../src/domain/simulation/core/SimulationRunner";
import { createMockGameState } from '../setup';
import type { GameState } from '../../src/domain/types/game-types';
import { TaskSystem } from "../../src/domain/simulation/systems/TaskSystem";

describe('SimulationRunner Throttling', () => {
  let runner: SimulationRunner;
  let initialState: GameState;
  let taskSystem: TaskSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    initialState = createMockGameState();

    // Reset container bindings
    container.unbind(TYPES.GameState);
    container.bind<GameState>(TYPES.GameState).toConstantValue(initialState);

    container.unbind(TYPES.SimulationConfig);
    container.bind(TYPES.SimulationConfig).toConstantValue({ tickIntervalMs: 10, maxCommandQueue: 10 });

    // Ensure TaskSystem is bound and we can spy on it
    // (Assuming it's already bound in setup.ts, but we get it to spy)
    taskSystem = container.get<TaskSystem>(TYPES.TaskSystem);

    container.unbind(TYPES.SimulationRunner);
    container.bind<SimulationRunner>(TYPES.SimulationRunner).to(SimulationRunner).inSingletonScope();
    runner = container.get<SimulationRunner>(TYPES.SimulationRunner);
  });

  afterEach(() => {
    runner.stop();
    vi.useRealTimers();
  });

  it('should throttle state synchronization to approximately 250ms', () => {
    const syncTasksSpy = vi.spyOn(taskSystem, 'syncTasksState');

    // Start the runner
    // We need to manually configure hooks because we are not calling initialize()
    (runner as any).configureSchedulerHooks();
    runner.start();

    // Advance time by 50ms (FAST tick)
    // Date.now() = 50. lastStateSync = 0. 50 - 0 < 250.
    vi.advanceTimersByTime(50);
    expect(syncTasksSpy).not.toHaveBeenCalled();

    // Advance to 200ms
    // Date.now() = 200. 200 - 0 < 250.
    vi.advanceTimersByTime(150);
    expect(syncTasksSpy).not.toHaveBeenCalled();

    // Advance to 250ms
    // Date.now() = 250. 250 - 0 >= 250. Should call sync.
    vi.advanceTimersByTime(50);
    expect(syncTasksSpy).toHaveBeenCalledTimes(1);

    // Advance to 300ms
    // Date.now() = 300. lastStateSync = 250. 300 - 250 < 250.
    vi.advanceTimersByTime(50);
    expect(syncTasksSpy).toHaveBeenCalledTimes(1);

    // Advance to 500ms
    // Date.now() = 500. 500 - 250 >= 250. Should call sync again.
    vi.advanceTimersByTime(200);
    expect(syncTasksSpy).toHaveBeenCalledTimes(2);
  });
});
