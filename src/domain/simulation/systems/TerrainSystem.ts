import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";
import { GameState } from "../../types/game-types";
import { TerrainTile } from "../../world/generation/types";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "@/infrastructure/utils/logger";

@injectable()
export class TerrainSystem {
  private gameState: GameState;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    logger.info("🌍 TerrainSystem initialized");
  }

  public getTile(x: number, y: number): TerrainTile | null {
    if (!this.gameState.world?.terrain) return null;

    // Assuming terrain is a 2D array [y][x] based on WorldGenerationService
    if (y >= 0 && y < this.gameState.world.terrain.length) {
      const row = this.gameState.world.terrain[y];
      if (x >= 0 && x < row.length) {
        // The structure in GameState.world.terrain is slightly different from TerrainTile interface
        // It matches the structure in WorldGenerationService: { x, y, biome, assets, ... }
        // We cast it to TerrainTile for convenience if it matches, or map it.
        // Looking at GameState definition:
        // world?: { terrain: Array<Array<{ x, y, biome, assets: { terrain, ... }, ... }>> }
        return row[x] as unknown as TerrainTile;
      }
    }
    return null;
  }

  public modifyTile(x: number, y: number, updates: Partial<TerrainTile> | { assets: Partial<TerrainTile["assets"]> }): boolean {
    if (!this.gameState.world?.terrain) return false;

    if (y >= 0 && y < this.gameState.world.terrain.length) {
      const row = this.gameState.world.terrain[y];
      if (x >= 0 && x < row.length) {
        // We cast to unknown then to TerrainTile because GameState definition is slightly different
        // but compatible in structure for our needs here.
        const tile = row[x] as unknown as TerrainTile;

        let modified = false;

        if ("assets" in updates && updates.assets) {
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
          simulationEvents.emit(GameEventNames.TERRAIN_MODIFIED, {
            x,
            y,
            updates,
            timestamp: Date.now()
          });
          return true;
        }
      }
    }
    return false;
  }
}
