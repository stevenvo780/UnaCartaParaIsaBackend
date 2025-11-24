import type {
  ConversationState,
  GameResources,
  GameState,
} from "../../types/game-types";

const defaultResources: GameResources = {
  energy: 0,
  materials: {
    wood: 0,
    stone: 0,
    food: 0,
    water: 0,
  },
  currency: 0,
  experience: 0,
  unlockedFeatures: [],
};

export function createInitialConversation(now: number): ConversationState {
  return {
    isActive: false,
    participants: [],
    lastSpeaker: null,
    lastDialogue: null,
    startTime: now,
  };
}

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

export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
