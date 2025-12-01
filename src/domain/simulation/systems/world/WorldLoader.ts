import { logger } from "../../../../infrastructure/utils/logger";
import { Zone } from "@/shared/types/game-types";
import { BiomeType } from "./generation/types";
import type { BuildingLabel } from "@/shared/types/simulation/buildings";
import type { SimulationRunner } from "../../core/SimulationRunner";
import { LifeStage, Sex } from "@/shared/types/simulation/agents";
import { TileType } from "../../../../shared/constants/TileTypeEnums";
import {
  StockpileType,
  ZoneType,
} from "../../../../shared/constants/ZoneEnums";
import { BuildingType } from "../../../../shared/constants/BuildingEnums";
import { ResourceType } from "../../../../shared/constants/ResourceEnums";

export class WorldLoader {
  constructor(private runner: SimulationRunner) {}

  public async initializeWorldResources(worldConfig: {
    width: number;
    height: number;
    tileSize: number;
    biomeMap: string[][];
  }): Promise<void> {
    logger.info(
      `Generating initial world ${worldConfig.width}x${worldConfig.height}...`,
    );

    const CHUNK_SIZE = 16;
    const chunksX = Math.ceil(worldConfig.width / CHUNK_SIZE);
    const chunksY = Math.ceil(worldConfig.height / CHUNK_SIZE);
    const allTiles: Array<{
      x: number;
      y: number;
      assetId: string;
      type: TileType;
      biome: string;
      isWalkable: boolean;
    }> = [];

    const biomeMap: string[][] = Array(worldConfig.height)
      .fill(null)
      .map((): string[] => {
        return Array(worldConfig.width).fill("") as string[];
      });

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkTiles =
          await this.runner.worldGenerationService.generateChunk(cx, cy, {
            width: worldConfig.width,
            height: worldConfig.height,
            tileSize: worldConfig.tileSize,
            seed: 12345,
            noise: {
              temperature: {
                scale: 0.0005,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0,
              },
              moisture: {
                scale: 0.0005,
                octaves: 3,
                persistence: 0.6,
                lacunarity: 2.0,
              },
              elevation: {
                scale: 0.0005,
                octaves: 5,
                persistence: 0.4,
                lacunarity: 2.0,
              },
            },
          });

        for (const row of chunkTiles) {
          for (const tile of row) {
            if (tile.x < worldConfig.width && tile.y < worldConfig.height) {
              const tileType: TileType =
                tile.biome === BiomeType.OCEAN
                  ? TileType.WATER
                  : TileType.GRASS;
              allTiles.push({
                x: tile.x,
                y: tile.y,
                assetId: tile.assets.terrain,
                type: tileType,
                biome: String(tile.biome),
                isWalkable: tile.isWalkable ?? true,
              });
              biomeMap[tile.y][tile.x] = String(tile.biome);
            }
          }
        }
      }
    }

    this.runner.state.terrainTiles = allTiles;
    this.runner.state.worldSize = {
      width: worldConfig.width * worldConfig.tileSize,
      height: worldConfig.height * worldConfig.tileSize,
    };
    logger.info(
      `Generated ${allTiles.length} terrain tiles. WorldSize: ${this.runner.state.worldSize.width}x${this.runner.state.worldSize.height} pixels.`,
    );

    this.runner.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap,
    });
  }

  public async ensureInitialFamily(): Promise<void> {
    let isa = this.runner.agentRegistry.getProfile("isa");
    if (!isa) {
      isa = this.runner.lifeCycleSystem.spawnAgent({
        id: "isa",
        name: "Isa",
        sex: Sex.FEMALE,
        ageYears: 25,
        lifeStage: LifeStage.ADULT,
        generation: 0,
        immortal: true,
        traits: {
          cooperation: 0.8,
          aggression: 0.2,
          diligence: 0.7,
          curiosity: 0.9,
        },
      });
      this.runner._genealogySystem.registerBirth(isa, undefined, undefined);
      logger.info("👩 Created missing parent: Isa");
    }

    let stev = this.runner.agentRegistry.getProfile("stev");
    if (!stev) {
      stev = this.runner.lifeCycleSystem.spawnAgent({
        id: "stev",
        name: "Stev",
        sex: Sex.MALE,
        ageYears: 27,
        lifeStage: LifeStage.ADULT,
        generation: 0,
        immortal: true,
        traits: {
          cooperation: 0.7,
          aggression: 0.3,
          diligence: 0.8,
          curiosity: 0.8,
        },
      });
      this.runner._genealogySystem.registerBirth(stev, undefined, undefined);
      logger.info("👨 Created missing parent: Stev");
    }

    logger.info(`👨‍👩‍👧‍👦 Ensuring initial family...`);

    const childNames = [
      { name: "Luna", sex: Sex.FEMALE as const },
      { name: "Sol", sex: Sex.MALE as const },
      { name: "Estrella", sex: Sex.FEMALE as const },
      { name: "Cielo", sex: Sex.MALE as const },
      { name: "Mar", sex: Sex.FEMALE as const },
      { name: "Rio", sex: Sex.MALE as const },
    ];

    let childrenCreated = 0;
    for (const childData of childNames) {
      const existingChild = this.runner.state.agents.find(
        (a) =>
          a.name === childData.name &&
          a.generation === 1 &&
          (a.parents?.father === "stev" || a.parents?.mother === "isa"),
      );

      if (!existingChild) {
        logger.info(
          `👶 Child ${childData.name} not found. Attempting to spawn...`,
        );
        try {
          const child = this.runner.lifeCycleSystem.spawnAgent({
            name: childData.name,
            sex: childData.sex,
            ageYears: 20,
            lifeStage: LifeStage.ADULT,
            generation: 1,
            parents: {
              father: stev.id,
              mother: isa.id,
            },
          });

          this.runner._genealogySystem.registerBirth(child, stev.id, isa.id);
          childrenCreated++;
          logger.info(`✅ Spawned child: ${child.name} (${child.id})`);
        } catch (error) {
          logger.error(`❌ Failed to spawn child ${childData.name}:`, error);
        }
      } else {
        logger.debug(
          `👶 Child ${childData.name} already exists (${existingChild.id})`,
        );
      }
    }

    if (childrenCreated > 0) {
      logger.info(
        `👶 Created ${childrenCreated} missing children for Isa & Stev`,
      );
    } else {
      logger.info(`👶 No new children created (all exist or failed).`);
    }

    if (
      !this.runner.state.zones ||
      this.runner.state.zones.length === 0 ||
      childrenCreated > 0
    ) {
      this.createInitialInfrastructure();
    }

    for (const agent of this.runner.state.agents) {
      try {
        if (!agent.position) {
          agent.position = {
            x: (this.runner.state.worldSize?.width ?? 2048) / 2,
            y: (this.runner.state.worldSize?.height ?? 2048) / 2,
          };
        }
        const hasState = this.runner.movementSystem.hasMovementState(agent.id);
        logger.info(
          `🚶 [WorldLoader] ${agent.id}: hasMovementState=${hasState}, pos=${agent.position.x.toFixed(0)},${agent.position.y.toFixed(0)}`,
        );
        if (!hasState) {
          this.runner.movementSystem.initializeEntityMovement(
            agent.id,
            agent.position,
          );
          logger.info(
            `🚶 [WorldLoader] ${agent.id}: Movement state initialized`,
          );
        }
      } catch (err) {
        logger.warn(
          `Failed to initialize movement state for agent ${agent.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.spawnInitialAnimals();
  }

  /**
   * Spawns initial animals near agent spawn points.
   *
   * Ensures the backend has huntable animals from the start, regardless
   * of whether frontend requests chunks. Spawns in a 5x5 grid of chunks
   * around the average agent position.
   */
  private spawnInitialAnimals(): void {
    const animalSystem = this.runner.animalSystem;
    const tileSize = 64;
    const chunkTileSize = 16;
    const chunkPixelSize = chunkTileSize * tileSize;

    const agents = this.runner.state.agents;
    if (agents.length === 0) {
      logger.warn(
        "🐾 [WorldLoader] No agents found, spawning animals at origin",
      );
    }

    let avgX = 0;
    let avgY = 0;
    let count = 0;

    for (const agent of agents) {
      if (agent.position) {
        avgX += agent.position.x;
        avgY += agent.position.y;
        count++;
      }
    }

    const centerX = count > 0 ? avgX / count : 0;
    const centerY = count > 0 ? avgY / count : 0;

    const centerChunkX = Math.max(0, Math.floor(centerX / chunkPixelSize));
    const centerChunkY = Math.max(0, Math.floor(centerY / chunkPixelSize));

    logger.info(
      `🐾 [WorldLoader] Spawning animals around agent center: (${Math.round(centerX)}, ${Math.round(centerY)}) = chunk (${centerChunkX}, ${centerChunkY})`,
    );

    const chunkRadius = 2;
    let totalSpawned = 0;

    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
        const chunkX = centerChunkX + dx;
        const chunkY = centerChunkY + dy;

        if (chunkX < 0 || chunkY < 0) continue;

        const spawned = animalSystem.spawnAnimalsForChunk(
          { x: chunkX, y: chunkY },
          {
            x: chunkX * chunkPixelSize,
            y: chunkY * chunkPixelSize,
            width: chunkPixelSize,
            height: chunkPixelSize,
          },
        );
        totalSpawned += spawned;
      }
    }

    logger.info(
      `🐾 [WorldLoader] Spawned ${totalSpawned} initial animals in ${(chunkRadius * 2 + 1) ** 2} chunks around agent spawn area`,
    );
  }

  private createInitialInfrastructure(): void {
    const baseX = 100;
    const baseY = 100;

    const defaultBiome = "Grassland";

    this.runner.state.zones = [];

    const houseZone: Zone = {
      id: `zone_house_initial_${Date.now()}`,
      type: ZoneType.SHELTER,
      bounds: {
        x: baseX,
        y: baseY,
        width: 80,
        height: 60,
      },
      props: {
        capacity: 8,
        comfort: 0.7,
      },
      metadata: {
        building: BuildingType.HOUSE as BuildingLabel,
        underConstruction: false,
        buildingId: `building_house_initial_${Date.now()}`,
        builtAt: Date.now(),
        biome: defaultBiome,
        buildingType: BuildingType.HOUSE,
        spriteVariant: 0,
      },
    };

    const workbenchZone: Zone = {
      id: `zone_workbench_initial_${Date.now()}`,
      type: ZoneType.WORK,
      bounds: {
        x: baseX + 150,
        y: baseY,
        width: 40,
        height: 40,
      },
      props: {
        craftingSpeed: 1.2,
        toolQuality: 0.8,
      },
      metadata: {
        building: "workbench" as BuildingLabel,
        underConstruction: false,
        craftingStation: true,
        buildingId: `building_workbench_initial_${Date.now()}`,
        builtAt: Date.now(),
        biome: defaultBiome,
        buildingType: BuildingType.WORKBENCH,
        spriteVariant: 0,
      },
    };

    const storageZone: Zone = {
      id: `zone_storage_initial_${Date.now()}`,
      type: ZoneType.STORAGE,
      bounds: {
        x: baseX + 150,
        y: baseY + 80,
        width: 40,
        height: 30,
      },
      props: {
        capacity: 200,
      },
      metadata: {
        buildingId: `building_storage_initial_${Date.now()}`,
        builtAt: Date.now(),
        biome: defaultBiome,
        buildingType: "storage",
        spriteVariant: 0,
      },
    };

    this.runner.state.zones.push(houseZone, workbenchZone, storageZone);

    const stockpile = this.runner.inventorySystem.createStockpile(
      storageZone.id,
      StockpileType.GENERAL,
      200,
    );

    this.runner.inventorySystem.addToStockpile(
      stockpile.id,
      ResourceType.WOOD,
      50,
    );
    this.runner.inventorySystem.addToStockpile(
      stockpile.id,
      ResourceType.STONE,
      30,
    );
    this.runner.inventorySystem.addToStockpile(
      stockpile.id,
      ResourceType.FOOD,
      40,
    );
    this.runner.inventorySystem.addToStockpile(
      stockpile.id,
      ResourceType.WATER,
      40,
    );

    logger.info(`🏠 Initial infrastructure created:`);
    logger.info(`   - Family house (shelter) at (${baseX}, ${baseY})`);
    logger.info(`   - Workbench at (${baseX + 100}, ${baseY})`);
    logger.info(`   - Storage zone with stockpile (id=${stockpile.id})`);
    logger.info(`   - Rest zone (inside house)`);
    logger.info(`   - Kitchen zone (inside house)`);
    logger.info(`📦 Starting resources: wood=50, stone=30, food=40, water=40`);
  }
}
