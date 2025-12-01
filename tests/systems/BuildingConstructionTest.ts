import "reflect-metadata";
import { Container } from "inversify";
import { TYPES } from "../../../config/Types";
import { BuildingSystem } from "../../../domain/simulation/systems/structures/BuildingSystem";
import { TerrainSystem } from "../../../domain/simulation/systems/core/TerrainSystem";
import { ResourceReservationSystem } from "../../../domain/simulation/systems/economy/ResourceReservationSystem";
import {
  GameState,
  SimulationTerrainTile,
} from "../../../domain/types/game-types";
import { BiomeType } from "../../../domain/world/generation/types";
import { createInitialGameState } from "../../../domain/simulation/core/defaultState";
import { logger } from "../../../infrastructure/utils/logger";

// Mock Systems
class MockResourceReservationSystem {
  public reserve(): boolean {
    return true;
  }
  public consume(): boolean {
    return true;
  }
  public release(): void {}
}

// Setup Container
const container = new Container();
const mockGameState = createInitialGameState();
logger.info(`Initial state keys: ${Object.keys(mockGameState)}`);
logger.info(`Initial world: ${JSON.stringify(mockGameState.world)}`);

// Create a simple 4x4 world
const terrain: SimulationTerrainTile[][] = [];
for (let y = 0; y < 4; y++) {
  const row: SimulationTerrainTile[] = [];
  for (let x = 0; x < 4; x++) {
    row.push({
      x,
      y,
      biome: BiomeType.GRASSLAND,
      isWalkable: true,
      assets: {
        terrain: "terrain_grassland",
        vegetation: [],
        structures: [],
      },
    });
  }
  terrain.push(row);
}

if (mockGameState.world) {
  mockGameState.world.terrain = terrain;
  mockGameState.world.config.width = 4;
  mockGameState.world.config.height = 4;
  mockGameState.world.config.tileSize = 64;
}
mockGameState.worldSize = { width: 256, height: 256 }; // 4 * 64

container.bind<GameState>(TYPES.GameState).toConstantValue(mockGameState);
container
  .bind<ResourceReservationSystem>(TYPES.ResourceReservationSystem)
  .to(
    MockResourceReservationSystem as unknown as new () => ResourceReservationSystem,
  );
container
  .bind<TerrainSystem>(TYPES.TerrainSystem)
  .to(TerrainSystem)
  .inSingletonScope();
container
  .bind<BuildingSystem>(TYPES.BuildingSystem)
  .to(BuildingSystem)
  .inSingletonScope();

// Test Execution
async function runTest(): Promise<void> {
  logger.info("🧪 Starting Building Construction Verification Test");

  const buildingSystem = container.get<BuildingSystem>(TYPES.BuildingSystem);
  const terrainSystem = container.get<TerrainSystem>(TYPES.TerrainSystem);

  logger.info("🏗️ Triggering building construction...");

  // Debug terrain before
  logger.info(`World object: ${JSON.stringify(mockGameState.world)}`);
  logger.info(`Terrain dimensions: ${mockGameState.world?.terrain?.length}`);
  const t11 = terrainSystem.getTile(1, 1);
  logger.info(`Tile (1,1) before: ${t11?.assets.terrain}`);

  // Force construction at a specific location (1,1) -> (64, 64)
  // Building size is 120x80.
  // At (64, 64), it covers:
  // x: 64 to 184 (tiles 1, 2)
  // y: 64 to 144 (tiles 1, 2)

  const success = buildingSystem.constructBuilding("house", { x: 64, y: 64 });

  if (!success) {
    logger.error("❌ Failed to schedule construction!");
    process.exit(1);
  }

  logger.info("✅ Construction scheduled successfully.");

  // Verify terrain modification
  // We expect tiles (1,1), (2,1), (1,2), (2,2) to be modified to dirt.
  // Actually, let's check which tiles are covered.
  // Bounds: x=64, y=64, w=120, h=80
  // x range: 64 to 184. Tile indices: floor(64/64)=1, floor(184/64)=2. So x=1,2.
  // y range: 64 to 144. Tile indices: floor(64/64)=1, floor(144/64)=2. So y=1,2.

  const expectedModifiedTiles = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ];

  let allCorrect = true;

  for (const coords of expectedModifiedTiles) {
    const tile = terrainSystem.getTile(coords.x, coords.y);
    if (tile && tile.assets.terrain === "terrain_dirt") {
      logger.info(`✅ Tile (${coords.x}, ${coords.y}) modified to dirt!`);
    } else {
      logger.error(
        `❌ Tile (${coords.x}, ${coords.y}) was NOT modified! Found: ${tile?.assets.terrain}`,
      );
      allCorrect = false;
    }
  }

  // Check a tile outside the building
  const outsideTile = terrainSystem.getTile(0, 0);
  if (outsideTile && outsideTile.assets.terrain === "terrain_grassland") {
    logger.info("✅ Outside tile (0, 0) correctly preserved.");
  } else {
    logger.error("❌ Outside tile (0, 0) was incorrectly modified!");
    allCorrect = false;
  }

  if (allCorrect) {
    logger.info("🎉 Building terrain alteration verification PASSED!");
  } else {
    logger.error("💥 Building terrain alteration verification FAILED!");
    process.exit(1);
  }
}

runTest().catch((err) => {
  logger.error("Test failed with error:", err);
  process.exit(1);
});
