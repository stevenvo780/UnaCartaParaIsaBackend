import { Container } from "inversify";
import { TYPES } from "./src/config/Types";
import { WorldResourceSystem } from "./src/domain/simulation/systems/WorldResourceSystem";
import { GameState } from "./src/domain/types/game-types";
import { logger } from "./src/infrastructure/utils/logger";

// Mock logger to avoid clutter
logger.info = () => { };

const container = new Container();

// Mock GameState
const mockGameState: GameState = {
  worldResources: {},
  zones: [],
  agents: [],
  entities: [],
  time: {
    totalTime: 0,
    day: 0,
    hour: 0,
    minute: 0,
    season: "spring",
    year: 0,
    timeScale: 1,
    isPaused: false,
  },
};

container.bind<GameState>(TYPES.GameState).toConstantValue(mockGameState);
container.bind<WorldResourceSystem>(TYPES.WorldResourceSystem).to(WorldResourceSystem);

const worldResourceSystem = container.get<WorldResourceSystem>(TYPES.WorldResourceSystem);

// Mock chunk data
const chunkCoords = { x: 0, y: 0 };
const chunkBounds = { x: 0, y: 0, width: 1024, height: 1024 };
const tiles = [
  [
    {
      x: 0,
      y: 0,
      assets: {
        terrain: "terrain_grassland",
        vegetation: ["tree_oak", "plant_berry"],
        decals: ["decal_rock", "decal_twig"],
      },
    },
  ],
];

// Test 1: Spawn resources
console.log("Test 1: Spawning resources...");
const spawnedCount = worldResourceSystem.spawnResourcesForChunk(chunkCoords, chunkBounds, tiles);
console.log(`Spawned count: ${spawnedCount}`);

// Expect 2 vegetation + 2 decals = 4 resources
if (spawnedCount === 4) {
  console.log("✅ Test 1 Passed: Correct number of resources spawned.");
} else {
  console.error(`❌ Test 1 Failed: Expected 4, got ${spawnedCount}`);
}

// Verify resources in state
const resources = Object.values(mockGameState.worldResources || {});
const trees = resources.filter((r) => r.type === "tree");
const berries = resources.filter((r) => r.type === "berry_bush");
// Decals can spawn various things, so just check total count
const total = resources.length;

if (trees.length === 1 && berries.length >= 1 && total === 4) {
  console.log("✅ Test 1 Verification Passed: Resources exist in state.");
} else {
  console.error(`❌ Test 1 Verification Failed: Incorrect resource types in state. Total: ${total}, Trees: ${trees.length}, Berries: ${berries.length}`);
}

// Test 2: Idempotency
console.log("\nTest 2: Checking idempotency...");
const spawnedCount2 = worldResourceSystem.spawnResourcesForChunk(chunkCoords, chunkBounds, tiles);
console.log(`Spawned count (2nd call): ${spawnedCount2}`);

if (spawnedCount2 === 0) {
  console.log("✅ Test 2 Passed: No duplicate resources spawned.");
} else {
  console.error(`❌ Test 2 Failed: Expected 0, got ${spawnedCount2}`);
}
