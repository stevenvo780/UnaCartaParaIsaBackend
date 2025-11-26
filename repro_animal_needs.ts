
import "reflect-metadata";
import { Container } from "inversify";
import { TYPES } from "./src/config/Types";
import { AnimalSystem } from "./src/domain/simulation/systems/AnimalSystem";
import { GameState } from "./src/domain/types/game-types";
import { logger } from "./src/infrastructure/utils/logger";
import { Animal } from "./src/domain/types/simulation/animals";

// Mock GameState
const mockGameState: GameState = {
  entities: [],
  agents: [],
  zones: [],
  animals: {
    animals: [],
    stats: { total: 0, byType: {} }
  },
  time: {
    totalTime: 0,
    day: 1,
    hour: 12,
    minute: 0,
    phase: "day",
    year: 1,
    season: "spring",
    temperature: 20,
    weather: "clear",
    isNight: false
  },
  worldSize: { width: 1000, height: 1000 }
};

// Setup Container
const container = new Container();
container.bind<GameState>(TYPES.GameState).toConstantValue(mockGameState);
container.bind<AnimalSystem>(TYPES.AnimalSystem).to(AnimalSystem).inSingletonScope();

// Mock other dependencies if needed (optional for this test if they are optional in AnimalSystem)
// AnimalSystem has optional dependencies: WorldResourceSystem, TerrainSystem, GPUComputeService

const animalSystem = container.get<AnimalSystem>(TYPES.AnimalSystem);

// Create a test animal
const testAnimal: Animal = {
  id: "test_rabbit_1",
  type: "rabbit",
  position: { x: 100, y: 100 },
  state: "idle",
  needs: {
    hunger: 100,
    thirst: 100,
    fear: 0,
    reproductiveUrge: 0
  },
  genes: {
    color: 1,
    size: 1,
    speed: 1,
    health: 1,
    fertility: 1
  },
  health: 15, // Half health (max is 30 for rabbit)
  age: 0,
  lastReproduction: 0,
  spawnedAt: Date.now(),
  generation: 0,
  parentIds: [null, null],
  targetPosition: null,
  currentTarget: null,
  fleeTarget: null,
  biome: "grassland",
  isDead: false
};

// Add animal to system (using private method via any or public if available)
// AnimalSystem has addAnimal as private, but spawnAnimal is public.
// Or we can just insert it into the map if we can access it.
// Let's use spawnAnimal if possible, or just cast to any.
(animalSystem as any).animals.set(testAnimal.id, testAnimal);
(animalSystem as any).addToSpatialGrid(testAnimal);

console.log("Initial State:");
console.log(`Hunger: ${testAnimal.needs.hunger}`);
console.log(`Thirst: ${testAnimal.needs.thirst}`);
console.log(`Health: ${testAnimal.health}`);

// Simulate updates
console.log("\nSimulating updates...");

// Run for 60 seconds (1 minute)
// AnimalSystem.update takes deltaMs
// We'll call it with 1000ms (1s) 60 times.

for (let i = 1; i <= 60; i++) {
  animalSystem.update(1000);

  if (i % 10 === 0) {
    console.log(`\nTime: ${i}s`);
    console.log(`Hunger: ${testAnimal.needs.hunger.toFixed(2)}`);
    console.log(`Thirst: ${testAnimal.needs.thirst.toFixed(2)}`);
    console.log(`Health: ${testAnimal.health.toFixed(2)}`);
  }
}

console.log("\nFinal State:");
console.log(`Hunger: ${testAnimal.needs.hunger.toFixed(2)}`);
console.log(`Thirst: ${testAnimal.needs.thirst.toFixed(2)}`);
console.log(`Health: ${testAnimal.health.toFixed(2)}`);

// Check if needs decayed
if (testAnimal.needs.hunger < 100 && testAnimal.needs.thirst < 100) {
  console.log("SUCCESS: Needs are decaying.");
} else {
  console.log("FAILURE: Needs are NOT decaying.");
}

// Check if health recovered (needs are still high enough > 80)
// Rabbit hunger decay is 4.0 per minute (real time? or game time?)
// AnimalNeeds uses deltaMinutes. 
// In AnimalSystem.update: const deltaMinutes = deltaMs / 60000;
// So passing 1000ms = 1/60 minutes.
// 60 calls = 1 minute total.
// Hunger decay = 4.0 * 1 = 4.0. Hunger should be 96.
// Thirst decay = 6.0 * 1 = 6.0. Thirst should be 94.
// Both > 80.
// Health recovery: 5% of max (30) = 1.5 per minute.
// Initial health 15. Final should be 16.5.

if (testAnimal.health > 15) {
  console.log("SUCCESS: Health is recovering.");
} else {
  console.log("FAILURE: Health is NOT recovering.");
}
