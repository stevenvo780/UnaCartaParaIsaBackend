import { vi } from "vitest";
import type { GameState } from "../src/domain/types/game-types.js";
import { createInitialGameState } from "../src/domain/simulation/core/defaultState.js";

// Mock TensorFlow para evitar errores de módulo nativo en tests
vi.mock("@tensorflow/tfjs-node-gpu", () => {
  const createMockTensor = (data: number | number[] | Float32Array, shape?: number[]) => {
    const values = Array.isArray(data) ? data : [data];
    return {
      dataSync: () => (Array.isArray(data) ? new Float32Array(data) : new Float32Array([data])),
      dispose: vi.fn(),
      shape: shape || [values.length],
    };
  };

  return {
    default: {
      ready: vi.fn().mockResolvedValue(undefined),
      getBackend: vi.fn().mockReturnValue("cpu"),
      tensor1d: vi.fn((data) => createMockTensor(data)),
      tensor2d: vi.fn((data, shape) => createMockTensor(data, shape)),
      scalar: vi.fn((value) => createMockTensor(value)),
      tidy: vi.fn((fn) => {
        try {
          return fn();
        } finally {
        }
      }),
      disposeVariables: vi.fn(),
    },
  };
});

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

