import { vi } from "vitest";
import type { GameState } from "../src/domain/types/game-types.js";
import { createInitialGameState } from "../src/domain/simulation/core/defaultState.js";
import { EntityIndex } from "../src/domain/simulation/core/EntityIndex.js";
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
  // QuestSystem removed - narrative quests not needed for simulation
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

  const mockTf = {
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
  };

  return {
    default: mockTf,
    ready: mockTf.ready, // Exportar ready directamente también
    getBackend: mockTf.getBackend,
    tensor1d: mockTf.tensor1d,
    tensor2d: mockTf.tensor2d,
    scalar: mockTf.scalar,
    tidy: mockTf.tidy,
    disposeVariables: mockTf.disposeVariables,
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
      getAgentInventory: vi.fn(() => ({})),
      addItem: vi.fn(),
      addResource: vi.fn(),
      removeItem: vi.fn(),
      removeFromAgent: vi.fn(),
      hasItem: vi.fn(() => false),
      getStockpilesInZone: vi.fn(() => []),
      getAllStockpiles: vi.fn(() => []),
      createStockpile: vi.fn(),
      transferToStockpile: vi.fn(),
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
      getActiveTasks: vi.fn(() => []),
      completeTask: vi.fn(),
      contributeToTask: vi.fn(),
    } as unknown as TaskSystem,
    combatSystem: {
      attack: vi.fn(),
      getCombatStats: vi.fn(() => ({ health: 100, stamina: 100 })),
      getNearbyEnemies: vi.fn(() => []),
      getEquipped: vi.fn(() => "unarmed"),
    } as unknown as CombatSystem,
    animalSystem: {
      getAnimals: vi.fn(() => new Map()),
      getAnimal: vi.fn(() => null),
      spawnAnimalsForChunk: vi.fn(),
    } as unknown as AnimalSystem,
    movementSystem: {
      moveTo: vi.fn(),
      stop: vi.fn(),
      isMoving: vi.fn(() => false),
      isMovingToPosition: vi.fn(() => false),
      isMovingToZone: vi.fn(() => false),
    } as unknown as MovementSystem,
    // questSystem removed - narrative quests not needed for simulation
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

/**
 * Crea un EntityIndex prebuildeado con el gameState proporcionado
 */
export function createEntityIndex(gameState: GameState): EntityIndex {
  const entityIndex = new EntityIndex();
  entityIndex.rebuild(gameState);
  return entityIndex;
}

/**
 * Creates a mock GPUComputeService for testing
 * Returns CPU fallback mode (isGPUAvailable = false) to avoid GPU-specific logic in tests
 */
export function createMockGPUService() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    isGPUAvailable: vi.fn().mockReturnValue(false),
    updatePositionsBatch: vi.fn((positions, targets, speeds, fatigue, deltaMs) => {
      // Simple CPU fallback mock
      const count = positions.length / 2;
      return {
        newPositions: positions,
        arrived: new Array(count).fill(false),
      };
    }),
    applyNeedsDecayBatch: vi.fn((needs, decayRates, ageMultipliers, divineModifiers, needCount, dt) => {
      return needs; // Return unchanged for simplicity
    }),
    applyNeedsCrossEffectsBatch: vi.fn((needs, needCount) => {
      return needs; // Return unchanged for simplicity
    }),
    updateFatigueBatch: vi.fn((fatigue, isMoving, isResting, deltaMs) => {
      return fatigue; // Return unchanged for simplicity
    }),
    decayAffinitiesBatch: vi.fn((affinities, decayRate, dt, minAffinity) => {
      return affinities; // Return unchanged for simplicity
    }),
    computePairwiseDistances: vi.fn((positions, count) => {
      // Return mock distance matrix
      const pairCount = (count * (count - 1)) / 2;
      return Promise.resolve({
        distances: new Float32Array(pairCount).fill(1000), // All far apart
      });
    }),
    getPerformanceStats: vi.fn(() => ({
      gpuAvailable: false,
      backend: 'cpu',
      gpuOperations: 0,
      cpuFallbacks: 0,
      avgGpuTime: 0,
      avgCpuTime: 0,
    })),
    dispose: vi.fn(),
  };
}

