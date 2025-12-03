import { injectable, inject } from "inversify";
import { TYPES } from "../../../../config/Types";
import { GameState, SimulationTerrainTile } from "@/shared/types/game-types";
import { TerrainTile } from "./generation/types";
import { simulationEvents, GameEventType } from "../../core/events";
import { logger } from "@/infrastructure/utils/logger";
import { SystemProperty } from "../../../../shared/constants/SystemEnums";
import { BiomeType } from "../../../../shared/constants/BiomeEnums";

/**
 * Tracks water level per tile for consumption mechanics.
 * When water reaches 0, OCEAN tile converts to DIRT.
 */
interface WaterTileState {
  waterLevel: number; // 0-100, starts at 100 for OCEAN tiles
  maxWater: number;
}

@injectable()
export class TerrainSystem {
  private gameState: GameState;
  
  /** Water levels per tile: key = "x,y", value = WaterTileState */
  private waterLevels = new Map<string, WaterTileState>();
  
  /** Default water capacity for OCEAN tiles */
  private static readonly OCEAN_WATER_CAPACITY = 100;
  /** Amount consumed per drink action */
  private static readonly WATER_PER_DRINK = 5;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    logger.info("🌍 TerrainSystem initialized");
  }

  /**
   * Gets a terrain tile at the specified coordinates.
   *
   * Terrain is stored as a 2D array [y][x] based on WorldGenerationService.
   * The structure matches WorldGenerationService: { x, y, biome, assets, ... }
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Terrain tile or null if out of bounds
   */
  public getTile(x: number, y: number): SimulationTerrainTile | null {
    if (!this.gameState.world?.terrain) return null;

    if (y >= 0 && y < this.gameState.world.terrain.length) {
      const row = this.gameState.world.terrain[y];
      if (x >= 0 && x < row.length) {
        return this.gameState.world.terrain[y][x];
      }
    }
    return null;
  }

  public modifyTile(
    x: number,
    y: number,
    updates:
      | Partial<SimulationTerrainTile>
      | { assets: Partial<SimulationTerrainTile[SystemProperty.ASSETS]> },
  ): boolean {
    if (!this.gameState.world?.terrain) return false;

    if (y >= 0 && y < this.gameState.world.terrain.length) {
      const row = this.gameState.world.terrain[y];
      if (x >= 0 && x < row.length) {
        const tile = row[x] as unknown as TerrainTile;

        let modified = false;

        if (SystemProperty.ASSETS in updates && updates.assets) {
          if (updates.assets.terrain) {
            tile.assets.terrain = updates.assets.terrain;
            modified = true;
          }
          if (updates.assets.vegetation) {
            tile.assets.vegetation = updates.assets.vegetation;
            modified = true;
          }
        }

        // Handle biome change
        if ("biome" in updates && updates.biome) {
          tile.biome = updates.biome as BiomeType;
          modified = true;
        }

        if (modified) {
          simulationEvents.emit(GameEventType.TERRAIN_MODIFIED, {
            x,
            y,
            updates,
            timestamp: Date.now(),
          });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Consume water from an OCEAN tile.
   * Returns true if water was consumed successfully.
   * If water level reaches 0, converts tile to DIRT.
   * 
   * @param tileX - Tile X coordinate
   * @param tileY - Tile Y coordinate
   * @returns Amount of water consumed (0 if tile has no water)
   */
  public consumeWaterFromTile(tileX: number, tileY: number): number {
    const tile = this.getTile(tileX, tileY);
    if (!tile) return 0;

    // Both OCEAN and LAKE tiles have water
    if (tile.biome !== BiomeType.OCEAN && tile.biome !== BiomeType.LAKE) return 0;

    const key = `${tileX},${tileY}`;
    
    // Initialize water level if not tracked
    if (!this.waterLevels.has(key)) {
      this.waterLevels.set(key, {
        waterLevel: TerrainSystem.OCEAN_WATER_CAPACITY,
        maxWater: TerrainSystem.OCEAN_WATER_CAPACITY,
      });
    }

    const waterState = this.waterLevels.get(key)!;
    
    if (waterState.waterLevel <= 0) {
      return 0;
    }

    // Consume water
    const consumed = Math.min(TerrainSystem.WATER_PER_DRINK, waterState.waterLevel);
    waterState.waterLevel -= consumed;

    logger.debug(
      `💧 [TerrainSystem] Water consumed at (${tileX}, ${tileY}): ${consumed} units, remaining: ${waterState.waterLevel}/${waterState.maxWater}`,
    );

    // If water depleted, convert OCEAN to DIRT
    if (waterState.waterLevel <= 0) {
      this.convertOceanToDirt(tileX, tileY);
    }

    return consumed;
  }

  /**
   * Convert an OCEAN tile to DIRT (dried up water body).
   */
  private convertOceanToDirt(tileX: number, tileY: number): void {
    const tile = this.getTile(tileX, tileY);
    if (!tile || tile.biome !== BiomeType.OCEAN) return;

    // Update biome to DIRT/GRASSLAND
    const success = this.modifyTile(tileX, tileY, {
      biome: BiomeType.GRASSLAND,
      assets: {
        terrain: "terrain_grassland",
      },
    });

    if (success) {
      logger.info(
        `🏜️ [TerrainSystem] OCEAN tile at (${tileX}, ${tileY}) dried up and converted to GRASSLAND`,
      );
      
      // Remove from water tracking
      this.waterLevels.delete(`${tileX},${tileY}`);

      // Emit specific event for water depletion
      simulationEvents.emit(GameEventType.TERRAIN_MODIFIED, {
        x: tileX,
        y: tileY,
        type: "water_depleted",
        previousBiome: BiomeType.OCEAN,
        newBiome: BiomeType.GRASSLAND,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get remaining water level for a tile (for UI display).
   * Returns 0 for non-water tiles.
   */
  public getWaterLevel(tileX: number, tileY: number): number {
    const tile = this.getTile(tileX, tileY);
    if (!tile || tile.biome !== BiomeType.OCEAN) return 0;

    const key = `${tileX},${tileY}`;
    const waterState = this.waterLevels.get(key);
    
    return waterState?.waterLevel ?? TerrainSystem.OCEAN_WATER_CAPACITY;
  }
}
