import { vi } from "vitest";
import type { GameState } from "../src/domain/types/game-types.js";
import { createInitialGameState } from "../src/domain/simulation/core/defaultState.js";
import type {
  NeedsSystem,
  WorldResourceSystem,
  InventorySystem,
  SocialSystem,
  EnhancedCraftingSystem,
  HouseholdSystem,
  TaskSystem,
  CombatSystem,
  AnimalSystem,
  MovementSystem,
  QuestSystem,
  TimeSystem,
} from "../src/domain/simulation/systems/index.js";
import type { RoleSystem } from "../src/domain/simulation/systems/RoleSystem.js";

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

/**
 * Crea mocks de sistemas para usar en tests de AISystem
 * Evita warnings sobre dependencias faltantes
 */
export function createMockAISystemDependencies() {
  return {
    needsSystem: {
      getEntityNeeds: vi.fn(() => ({
        hunger: 50,
        thirst: 50,
        energy: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
        mentalHealth: 50,
      })),
      initializeEntityNeeds: vi.fn(() => ({
        hunger: 50,
        thirst: 50,
        energy: 50,
        hygiene: 50,
        social: 50,
        fun: 50,
        mentalHealth: 50,
      })),
      satisfyNeed: vi.fn(),
      modifyNeed: vi.fn(),
    } as unknown as NeedsSystem,
    roleSystem: {
      getRole: vi.fn(() => null),
      assignRole: vi.fn(),
      removeRole: vi.fn(),
    } as unknown as RoleSystem,
    worldResourceSystem: {
      findNearestResource: vi.fn(() => null),
      getResourcesInRadius: vi.fn(() => []),
      consumeResource: vi.fn(),
    } as unknown as WorldResourceSystem,
    inventorySystem: {
      getInventory: vi.fn(() => ({ capacity: 100, items: {} })),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      hasItem: vi.fn(() => false),
    } as unknown as InventorySystem,
    socialSystem: {
      getAffinity: vi.fn(() => 0),
      setAffinity: vi.fn(),
      modifyAffinity: vi.fn(),
    } as unknown as SocialSystem,
    craftingSystem: {
      canCraft: vi.fn(() => false),
      craft: vi.fn(),
      getAvailableRecipes: vi.fn(() => []),
    } as unknown as EnhancedCraftingSystem,
    householdSystem: {
      getHousehold: vi.fn(() => null),
      createHousehold: vi.fn(),
    } as unknown as HouseholdSystem,
    taskSystem: {
      createTask: vi.fn(),
      getTask: vi.fn(() => null),
      completeTask: vi.fn(),
    } as unknown as TaskSystem,
    combatSystem: {
      attack: vi.fn(),
      getCombatStats: vi.fn(() => ({ health: 100, stamina: 100 })),
    } as unknown as CombatSystem,
    animalSystem: {
      getAnimals: vi.fn(() => new Map()),
      getAnimal: vi.fn(() => null),
      spawnAnimalsForChunk: vi.fn(),
    } as unknown as AnimalSystem,
    movementSystem: {
      moveTo: vi.fn(),
      stop: vi.fn(),
    } as unknown as MovementSystem,
    questSystem: {
      getActiveQuests: vi.fn(() => []),
      startQuest: vi.fn(),
      completeQuest: vi.fn(),
    } as unknown as QuestSystem,
    timeSystem: {
      getCurrentTime: vi.fn(() => Date.now()),
      getGameTime: vi.fn(() => 0),
    } as unknown as TimeSystem,
  };
}

/**
 * Helper para configurar fake timers de forma consistente
 */
export function setupFakeTimers(initialTime: number = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(initialTime);
}

/**
 * Helper para restaurar timers reales
 */
export function restoreRealTimers() {
  vi.useRealTimers();
}

/**
 * Helper para mockear Math.random de forma determinista
 */
export function mockRandom(returnValue: number) {
  return vi.spyOn(Math, "random").mockReturnValue(returnValue);
}

