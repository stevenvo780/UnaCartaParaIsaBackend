import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { container } from "../../src/config/container";
import { TYPES } from "../../src/config/Types";
import { SimulationRunner } from "../../src/domain/simulation/core/SimulationRunner";
import { MultiRateScheduler } from "../../src/domain/simulation/core/MultiRateScheduler"; // Added import
import { createMockGameState } from '../setup';
import type { GameState } from '../../src/domain/types/game-types';
import { TaskSystem } from "../../src/domain/simulation/systems/TaskSystem";

describe('SimulationRunner Throttling', () => {
  let runner: SimulationRunner;
  let mockScheduler: any;
  let postTickHook: () => void;
  let syncTasksSpy: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    // Get SimulationRunner instance
    container.unbind(TYPES.SimulationRunner);
    container.bind<SimulationRunner>(TYPES.SimulationRunner).to(SimulationRunner).inSingletonScope();
    runner = container.get<SimulationRunner>(TYPES.SimulationRunner);

    // Mock MultiRateScheduler and monkey-patch it onto the runner
    // Since MultiRateScheduler is instantiated in the constructor, we can overwrite it here
    mockScheduler = {
      setHooks: vi.fn(),
      registerSystem: vi.fn(),
      start: vi.fn(),
      getStats: vi.fn().mockReturnValue({ fast: {}, medium: {}, slow: {} }),
    };
    (runner as any).scheduler = mockScheduler;

    // Spy on syncTasksState
    const taskSystem = container.get<TaskSystem>(TYPES.TaskSystem);
    syncTasksSpy = vi.spyOn(taskSystem, 'syncTasksState');

    // Initialize runner to register hooks
    console.log('Starting runner...');
    await runner.initialize();
    runner.start();
    console.log('Runner started.');

    // Capture the postTick hook
    console.log('Mock scheduler calls:', mockScheduler.setHooks.mock.calls);
    const setHooksCall = mockScheduler.setHooks.mock.calls[0];
    if (setHooksCall) {
      postTickHook = setHooksCall[0].postTick;
      console.log('Captured postTickHook:', !!postTickHook);
    } else {
      console.log('setHooks was NOT called');
      // If start() didn't call setHooks, maybe it's called in constructor?
      // We'll find out.
    }
  });

  afterEach(() => {
    // No need to call runner.stop() if we're mocking the scheduler and not using real timers for the runner itself
    // vi.useRealTimers(); // This was in the original afterEach, but vi.useFakeTimers is now in the it block
  });

  it('should throttle state synchronization to approximately 250ms', () => {
    expect(postTickHook).toBeDefined();

    vi.useFakeTimers();
    vi.setSystemTime(0);
    const startTime = Date.now();
    syncTasksSpy.mockClear();

    // 1. Initial call at t=0
    // lastStateSync is 0. Date.now() is 0. Diff is 0. < 250. Should NOT run.
    postTickHook();
    expect(syncTasksSpy).not.toHaveBeenCalled();

    // 2. Advance to t=50ms
    vi.advanceTimersByTime(50);
    postTickHook();
    expect(syncTasksSpy).not.toHaveBeenCalled();

    // 3. Advance to t=250ms
    vi.advanceTimersByTime(200); // Total 250
    postTickHook();
    expect(syncTasksSpy).toHaveBeenCalledTimes(1);

    // 4. Advance to t=300ms
    vi.advanceTimersByTime(50); // Total 300
    postTickHook();
    expect(syncTasksSpy).toHaveBeenCalledTimes(1); // Should not have increased

    // 5. Advance to t=500ms
    vi.advanceTimersByTime(200); // Total 500
    postTickHook();
    expect(syncTasksSpy).toHaveBeenCalledTimes(2); // Should have increased

    vi.useRealTimers(); // Clean up fake timers
  });
});
