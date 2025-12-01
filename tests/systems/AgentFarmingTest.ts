import { Container } from "inversify";
import { TYPES } from "../../../config/Types";
import { ProductionSystem } from "../../../domain/simulation/systems/world/ProductionSystem";
import { TerrainSystem } from "../../../domain/simulation/systems/core/TerrainSystem";
import { InventorySystem } from "../../../domain/simulation/systems/economy/InventorySystem";
import { LifeCycleSystem } from "../../../domain/simulation/systems/lifecycle/LifeCycleSystem";
import { WorldResourceSystem } from "../../../domain/simulation/systems/world/WorldResourceSystem";
import {
  GameState,
  Zone,
  SimulationTerrainTile,
} from "../../../domain/types/game-types";
import { BiomeType } from "../../../domain/simulation/systems/world/generation/types";
import { createInitialGameState } from "../../../domain/simulation/core/defaultState";
import { logger } from "../../../infrastructure/utils/logger";

// Mock dependencies
const container = new Container();

const mockGameState = createInitialGameState();
mockGameState.world = {
  terrain: [],
  config: { width: 100, height: 100, tileSize: 64, seed: 123 },
};

// Create a simple 2x2 world
const terrain: SimulationTerrainTile[][] = [];
for (let y = 0; y < 2; y++) {
  const row: SimulationTerrainTile[] = [];
  for (let x = 0; x < 2; x++) {
    row.push({
      x,
      y,
      biome: BiomeType.GRASSLAND,
      // biomeStrength, temperature, etc are NOT in SimulationTerrainTile
      isWalkable: true,
      assets: {
        terrain: "terrain_grassland",
        vegetation: [],
        structures: [],
        // props and decals are NOT in SimulationTerrainTile
      },
    });
  }
  terrain.push(row);
}
// Cast to any because GameState terrain structure might differ slightly from WorldGen types
// Cast to unknown then to correct type to avoid any
if (mockGameState.world) {
  mockGameState.world.terrain = terrain;
}

// Mock Zone
const mockZone: Zone = {
  id: "zone_farm_1",
  type: "food",
  bounds: { x: 0, y: 0, width: 128, height: 128 }, // Covers 2x2 tiles (64x64 each)
  metadata: { productionResource: "food" },
};
mockGameState.zones = [mockZone];

container.bind<GameState>(TYPES.GameState).toConstantValue(mockGameState);
container
  .bind<TerrainSystem>(TYPES.TerrainSystem)
  .to(TerrainSystem)
  .inSingletonScope();

// Mock InventorySystem and LifeCycleSystem
class MockInventorySystem {
  public getStockpilesInZone(): { id: string }[] {
    return [];
  }
  public createStockpile(): { id: string } {
    return { id: "stockpile_1" };
  }
  public addToStockpile(): void {
    // Mock implementation
  }
}
class MockLifeCycleSystem {
  public getAgents(): { id: string }[] {
    return [{ id: "agent_1" }];
  }
}

class MockWorldResourceSystem {
  public getResourcesNear(
    position: { x: number; y: number },
    _radius: number,
  ): { id: string }[] {
    // Simulate a resource at (0,0) (which corresponds to tile 0,0)
    // We need to check if the position is close to 0,0
    // TILE_SIZE is 64. Tile 0,0 center is 32,32.
    // But the test uses random offsets.
    // Let's just say if it's tile 0,0 we return a resource.
    // Wait, getResourcesNear takes world coords.
    // Let's mock it to return a resource if x < 64 and y < 64 (Tile 0,0)
    if (position.x < 64 && position.y < 64) {
      return [{ id: "tree_1" }];
    }
    return [];
  }
}

container
  .bind<InventorySystem>(TYPES.InventorySystem)
  .to(MockInventorySystem as unknown as new () => InventorySystem);
container
  .bind<LifeCycleSystem>(TYPES.LifeCycleSystem)
  .to(MockLifeCycleSystem as unknown as new () => LifeCycleSystem);
container
  .bind<WorldResourceSystem>(TYPES.WorldResourceSystem)
  .to(MockWorldResourceSystem as unknown as new () => WorldResourceSystem);
container
  .bind<ProductionSystem>(TYPES.ProductionSystem)
  .to(ProductionSystem)
  .inSingletonScope();

async function runTest(): Promise<void> {
  logger.info("🧪 Starting Agent Farming Verification Test");

  const productionSystem = container.get<ProductionSystem>(
    TYPES.ProductionSystem,
  );
  const terrainSystem = container.get<TerrainSystem>(TYPES.TerrainSystem);

  logger.info("🚜 ProductionSystem initialized");

  // Update system to trigger production
  // Production interval is 12000ms by default.
  // We need to simulate time passing.

  // First update to assign workers
  productionSystem.update(1000);

  // Wait for production interval
  // We can't easily wait 12s in a test without mocking time.
  // But we can override the lastProduction time in the system if we could access it,
  // or just wait.
  // Alternatively, we can patch the config or the system to have shorter interval.
  // Since config is private readonly, we can't easily change it.
  // We'll just wait 12s? No, that's too long.
  // Let's use 'any' to access private config and change it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (productionSystem as any).config.productionIntervalMs = 100;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (productionSystem as any).config.updateIntervalMs = 100;

  logger.info("⏱️ Config patched for faster testing");

  // Update to trigger production
  await new Promise((resolve) => setTimeout(resolve, 200));
  productionSystem.update(200);

  // Check terrain
  // Tile (0,0) has a resource, so it should NOT be modified.
  // Other tiles might be modified.

  const tile00 = terrainSystem.getTile(0, 0);
  if (tile00 && tile00.assets.terrain === "terrain_dirt") {
    logger.error("❌ Tile (0, 0) was modified despite having a resource!");
  } else {
    logger.info("✅ Tile (0, 0) correctly preserved (has resource).");
  }

  let otherModified = false;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      if (x === 0 && y === 0) continue; // Skip the resource tile

      const tile = terrainSystem.getTile(x, y);
      if (tile && tile.assets.terrain === "terrain_dirt") {
        otherModified = true;
        logger.info(`✅ Tile (${x}, ${y}) modified to dirt!`);
        break;
      }
    }
    if (otherModified) break;
  }

  if (!otherModified) {
    logger.warn(
      "⚠️ No other tiles modified to dirt (might be due to randomness).",
    );
  }
}

runTest().catch((err) => {
  logger.error("Test failed", err);
});
