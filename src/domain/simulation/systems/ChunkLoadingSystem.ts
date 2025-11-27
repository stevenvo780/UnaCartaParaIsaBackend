import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";
import type { GameState } from "../../types/game-types";
import type { WorldGenerationService } from "../../../infrastructure/services/world/worldGenerationService";
import type { AnimalSystem } from "./AnimalSystem";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import { logger } from "../../../infrastructure/utils/logger";
import type { WorldGenConfig } from "../../world/generation/types";

/**
 * System for dynamically loading chunks around agents.
 *
 * This ensures that agents can explore the infinite world without requiring
 * the frontend camera to trigger chunk generation. When an agent moves near
 * an unloaded chunk, this system will:
 * - Generate terrain for that chunk
 * - Spawn animals in that chunk
 * - Spawn resources in that chunk
 *
 * This enables true autonomous agent exploration in an infinite world.
 */
@injectable()
export class ChunkLoadingSystem {
  private readonly CHUNK_SIZE = 16;
  private readonly LOAD_RADIUS_CHUNKS = 2; // Load chunks within 2 chunks of any agent
  private readonly CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
  private lastCheckTime = 0;

  // Track which chunks have been fully loaded (terrain + animals + resources)
  private loadedChunks = new Set<string>();

  // World generation config cached from initialization
  private worldConfig: WorldGenConfig | null = null;

  constructor(
    @inject(TYPES.GameState) private gameState: GameState,
    @inject(TYPES.WorldGenerationService) private worldGenerationService: WorldGenerationService,
    @inject(TYPES.AnimalSystem) private animalSystem: AnimalSystem,
    @inject(TYPES.WorldResourceSystem) private worldResourceSystem: WorldResourceSystem,
  ) {}

  /**
   * Initialize the system with world configuration
   */
  public initialize(config: WorldGenConfig): void {
    this.worldConfig = config;
    logger.info("🌍 ChunkLoadingSystem initialized with dynamic chunk loading");
  }

  /**
   * Update the chunk loading system
   * Periodically checks agent positions and loads nearby chunks
   */
  public update(_deltaMs: number): void {
    const now = Date.now();

    // Only check periodically to avoid performance impact
    if (now - this.lastCheckTime < this.CHECK_INTERVAL_MS) {
      return;
    }

    this.lastCheckTime = now;

    if (!this.worldConfig) {
      return;
    }

    // Get all active (non-dead) agents
    const activeAgents = this.gameState.agents.filter(
      (agent) => !agent.isDead && agent.position
    );

    if (activeAgents.length === 0) {
      return;
    }

    // Calculate which chunks need to be loaded based on agent positions
    const chunksToLoad = this.calculateChunksToLoad(activeAgents);

    if (chunksToLoad.length === 0) {
      return;
    }

    logger.debug(
      `🌍 ChunkLoadingSystem: Loading ${chunksToLoad.length} chunks for ${activeAgents.length} agents`
    );

    // Load chunks asynchronously (fire and forget)
    void this.loadChunks(chunksToLoad);
  }

  /**
   * Calculate which chunks need to be loaded based on agent positions
   */
  private calculateChunksToLoad(
    agents: Array<{ position: { x: number; y: number } }>
  ): Array<{ x: number; y: number }> {
    const chunksNeeded = new Set<string>();

    for (const agent of agents) {
      if (!agent.position) continue;

      // Convert agent position to chunk coordinates
      const agentChunkX = Math.floor(agent.position.x / (this.CHUNK_SIZE * (this.worldConfig?.tileSize ?? 16)));
      const agentChunkY = Math.floor(agent.position.y / (this.CHUNK_SIZE * (this.worldConfig?.tileSize ?? 16)));

      // Add chunks in a radius around the agent
      for (let dx = -this.LOAD_RADIUS_CHUNKS; dx <= this.LOAD_RADIUS_CHUNKS; dx++) {
        for (let dy = -this.LOAD_RADIUS_CHUNKS; dy <= this.LOAD_RADIUS_CHUNKS; dy++) {
          const chunkX = agentChunkX + dx;
          const chunkY = agentChunkY + dy;
          const chunkKey = `${chunkX},${chunkY}`;

          // Only add if not already loaded
          if (!this.loadedChunks.has(chunkKey)) {
            chunksNeeded.add(chunkKey);
          }
        }
      }
    }

    // Convert set to array of coordinates
    return Array.from(chunksNeeded).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  }

  /**
   * Load the specified chunks (terrain, animals, resources)
   */
  private async loadChunks(chunks: Array<{ x: number; y: number }>): Promise<void> {
    if (!this.worldConfig) {
      return;
    }

    for (const chunkCoords of chunks) {
      try {
        await this.loadChunk(chunkCoords);
      } catch (error) {
        logger.error(
          `❌ Failed to load chunk (${chunkCoords.x}, ${chunkCoords.y}):`,
          error
        );
      }
    }
  }

  /**
   * Load a single chunk (terrain, animals, resources)
   */
  private async loadChunk(chunkCoords: { x: number; y: number }): Promise<void> {
    if (!this.worldConfig) {
      return;
    }

    const chunkKey = `${chunkCoords.x},${chunkCoords.y}`;

    // Double-check it's not already loaded (race condition protection)
    if (this.loadedChunks.has(chunkKey)) {
      return;
    }

    const tileSize = this.worldConfig.tileSize ?? 16;
    const pixelWidth = this.CHUNK_SIZE * tileSize;
    const pixelHeight = this.CHUNK_SIZE * tileSize;
    const worldX = chunkCoords.x * pixelWidth;
    const worldY = chunkCoords.y * pixelHeight;

    logger.debug(
      `🌍 [ChunkLoadingSystem] Loading chunk (${chunkCoords.x},${chunkCoords.y}) at world position (${worldX},${worldY})`
    );

    // 1. Generate terrain for this chunk
    const chunkTiles = await this.worldGenerationService.generateChunk(
      chunkCoords.x,
      chunkCoords.y,
      this.worldConfig
    );

    // 2. Add terrain tiles to game state
    for (const row of chunkTiles) {
      for (const tile of row) {
        // Check if tile is within world bounds (if world has bounds)
        if (this.worldConfig.width && this.worldConfig.height) {
          if (tile.x >= this.worldConfig.width || tile.y >= this.worldConfig.height) {
            continue;
          }
        }

        // Only add if not already in terrain tiles (avoid duplicates)
        const existingTileIndex = this.gameState.terrainTiles?.findIndex(
          (t) => t.x === tile.x && t.y === tile.y
        );

        if (existingTileIndex === -1 || existingTileIndex === undefined) {
          const tileType: "grass" | "stone" | "water" | "path" =
            tile.biome === "ocean" ? "water" : "grass";

          this.gameState.terrainTiles?.push({
            x: tile.x,
            y: tile.y,
            assetId: tile.assets.terrain,
            type: tileType,
            biome: String(tile.biome),
            isWalkable: tile.isWalkable ?? true,
          });
        }
      }
    }

    // 3. Spawn animals for this chunk
    const spawned = this.animalSystem.spawnAnimalsForChunk(
      chunkCoords,
      { x: worldX, y: worldY, width: pixelWidth, height: pixelHeight },
      chunkTiles
    );

    if (spawned > 0) {
      logger.debug(
        `🐾 [ChunkLoadingSystem] Spawned ${spawned} animals for chunk (${chunkCoords.x},${chunkCoords.y})`
      );
    }

    // 4. Spawn resources for this chunk
    // Note: WorldResourceSystem.spawnResourcesInWorld spawns for entire world
    // For chunk-based spawning, we'd need a new method. For now, we skip this
    // as resources are spawned globally during world initialization.
    // TODO: Implement chunk-based resource spawning if needed

    // Mark chunk as loaded
    this.loadedChunks.add(chunkKey);

    logger.debug(
      `✅ [ChunkLoadingSystem] Chunk (${chunkCoords.x},${chunkCoords.y}) loaded successfully`
    );
  }

  /**
   * Clear all loaded chunks (for world reset)
   */
  public clearLoadedChunks(): void {
    this.loadedChunks.clear();
    logger.info("🌍 ChunkLoadingSystem: Cleared all loaded chunks");
  }

  /**
   * Check if a chunk is loaded
   */
  public isChunkLoaded(x: number, y: number): boolean {
    return this.loadedChunks.has(`${x},${y}`);
  }

  /**
   * Get count of loaded chunks
   */
  public getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }
}
