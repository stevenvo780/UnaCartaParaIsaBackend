import { vi } from "vitest";
import type { GameState } from "../src/types/game-types.js";
import { createInitialGameState } from "../src/simulation/defaultState.js";

export function createMockGameState(overrides?: Partial<GameState>): GameState {
  const baseState = createInitialGameState();
  return {
    ...baseState,
    ...overrides,
  };
}

export function createMockEventEmitter() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(callback);
      return this;
    }),
    off: vi.fn((event: string, callback?: (...args: unknown[]) => void) => {
      if (callback) {
        const callbacks = listeners.get(event) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        listeners.delete(event);
      }
      return this;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const callbacks = listeners.get(event) || [];
      callbacks.forEach((cb) => cb(...args));
      return callbacks.length > 0;
    }),
    removeAllListeners: vi.fn(() => {
      listeners.clear();
      return this;
    }),
  };
}

