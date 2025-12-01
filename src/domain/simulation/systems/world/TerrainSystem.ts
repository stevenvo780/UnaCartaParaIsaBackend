import { injectable, inject } from "inversify";
import { TYPES } from "../../../../config/Types";
import { GameState, SimulationTerrainTile } from "@/shared/types/game-types";
import { TerrainTile } from "./generation/types";
import { simulationEvents, GameEventType } from "../../core/events";
import { logger } from "@/infrastructure/utils/logger";
import { SystemProperty } from "../../../../shared/constants/SystemEnums";

@injectable()
export class TerrainSystem {
  private gameState: GameState;

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
}
