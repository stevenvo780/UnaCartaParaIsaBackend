import type {
  ConversationState,
  GameResources,
  GameState,
} from "../../types/game-types";

/**
 * Default resource values for new game states.
 */
const defaultResources: GameResources = {
  energy: 100,
  materials: {
    wood: 50,
    stone: 30,
    food: 40,
    water: 40,
  },
  currency: 100,
  experience: 0,
  unlockedFeatures: [],
};

/**
 * Creates an initial conversation state.
 *
 * @param now - Current timestamp
 * @returns Initial conversation state with no active participants
 */
export function createInitialConversation(now: number): ConversationState {
  return {
    isActive: false,
    participants: [],
    lastSpeaker: null,
    lastDialogue: null,
    startTime: now,
  };
}

/**
 * Creates a new game state with default values.
 * Initializes all required fields with empty arrays and default resources.
 *
 * @returns Fresh game state ready for simulation
 */
export function createInitialGameState(): GameState {
  const now = Date.now();
  return {
    agents: [],
    entities: [],
    resonance: 0,
    cycles: 0,
    lastSave: Date.now(),
    time: 0,
    dayTime: 0,
    togetherTime: 0,
    connectionAnimation: {
      active: false,
      startTime: 0,
      type: "NOURISH",
    },
    zones: [],
    mapElements: [],
    mapSeed: undefined,
    currentConversation: createInitialConversation(now),
    world: {
      terrain: [],
      config: {
        width: 0,
        height: 0,
        tileSize: 64,
        seed: 0,
      },
    },
    terrainTiles: [],
    roads: [],
    objectLayers: [],
    worldSize: { width: 2000, height: 2000 },
    generatorVersion: "backend-sim",
    playerLevel: 1,
    exploredBiomes: [],
    unlockedAssets: [],
    combatLog: [],
    weather: {
      current: "sunny",
      temperature: 24,
      humidity: 0.4,
      windSpeed: 2,
      visibility: 1,
      lastChange: now,
      duration: 60000,
    },
    resources: { ...defaultResources },
  };
}

/**
 * Clones the complete game state using structuredClone.
 * 2-3x faster than JSON.parse/stringify for deep cloning.
 *
 * @param state - Game state to clone
 * @returns Deep clone of the game state
 */
export function cloneGameState(state: GameState): GameState {
  try {
    return structuredClone(state);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "structuredClone failed, falling back to JSON:",
      err instanceof Error ? err.message : String(err),
    );
    return JSON.parse(JSON.stringify(state)) as GameState;
  }
}

/**
 * Clones only the sections of state that have changed (marked as dirty).
 * Much more efficient when only small parts of the state change.
 *
 * @param state - Current game state
 * @param dirtyFlags - Flags indicating which sections are dirty
 * @param previousSnapshot - Previous snapshot to reuse for non-dirty sections
 * @returns Cloned game state with only dirty sections re-cloned
 */
export function cloneGameStateDelta(
  state: GameState,
  dirtyFlags: {
    agents?: boolean;
    entities?: boolean;
    animals?: boolean;
    zones?: boolean;
    worldResources?: boolean;
    inventory?: boolean;
    socialGraph?: boolean;
    market?: boolean;
    [key: string]: boolean | undefined;
  },
  previousSnapshot?: GameState,
): GameState {
  if (!previousSnapshot || Object.values(dirtyFlags).every((dirty) => dirty)) {
    return cloneGameState(state);
  }

  const cloned: GameState = { ...state };

  if (dirtyFlags.agents) {
    if (state.agents !== previousSnapshot.agents) {
      cloned.agents = structuredClone(state.agents);
    } else {
      cloned.agents = previousSnapshot.agents;
    }
  } else if (previousSnapshot.agents) {
    cloned.agents = previousSnapshot.agents;
  }

  if (dirtyFlags.entities) {
    if (state.entities !== previousSnapshot.entities) {
      cloned.entities = structuredClone(state.entities);
    } else {
      cloned.entities = previousSnapshot.entities;
    }
  } else if (previousSnapshot.entities) {
    cloned.entities = previousSnapshot.entities;
  }

  if (dirtyFlags.animals) {
    if (state.animals !== previousSnapshot.animals) {
      cloned.animals = structuredClone(state.animals);
    } else {
      cloned.animals = previousSnapshot.animals;
    }
  } else if (previousSnapshot.animals) {
    cloned.animals = previousSnapshot.animals;
  }

  if (dirtyFlags.zones) {
    if (state.zones !== previousSnapshot.zones) {
      cloned.zones = structuredClone(state.zones);
    } else {
      cloned.zones = previousSnapshot.zones;
    }
  } else if (previousSnapshot.zones) {
    cloned.zones = previousSnapshot.zones;
  }

  if (dirtyFlags.worldResources) {
    if (state.worldResources !== previousSnapshot.worldResources) {
      cloned.worldResources = structuredClone(state.worldResources);
    } else {
      cloned.worldResources = previousSnapshot.worldResources;
    }
  } else if (previousSnapshot.worldResources) {
    cloned.worldResources = previousSnapshot.worldResources;
  }

  if (dirtyFlags.inventory) {
    if (state.inventory !== previousSnapshot.inventory) {
      cloned.inventory = structuredClone(state.inventory);
    } else {
      cloned.inventory = previousSnapshot.inventory;
    }
  } else if (previousSnapshot.inventory) {
    cloned.inventory = previousSnapshot.inventory;
  }

  if (dirtyFlags.socialGraph) {
    if (state.socialGraph !== previousSnapshot.socialGraph) {
      cloned.socialGraph = structuredClone(state.socialGraph);
    } else {
      cloned.socialGraph = previousSnapshot.socialGraph;
    }
  } else if (previousSnapshot.socialGraph) {
    cloned.socialGraph = previousSnapshot.socialGraph;
  }

  if (dirtyFlags.market) {
    if (state.market !== previousSnapshot.market) {
      cloned.market = structuredClone(state.market);
    } else {
      cloned.market = previousSnapshot.market;
    }
  } else if (previousSnapshot.market) {
    cloned.market = previousSnapshot.market;
  }

  cloned.time = state.time;
  cloned.dayTime = state.dayTime;
  cloned.togetherTime = state.togetherTime;
  cloned.cycles = state.cycles;
  cloned.weather = structuredClone(state.weather);
  cloned.resources = structuredClone(state.resources);

  return cloned;
}
