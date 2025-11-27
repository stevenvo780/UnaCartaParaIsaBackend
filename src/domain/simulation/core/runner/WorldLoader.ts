import { logger } from "../../../../infrastructure/utils/logger";
import { Zone } from "../../../types/game-types";
import { BiomeType } from "../../../world/generation/types";
import type { BuildingLabel } from "../../../types/simulation/buildings";
import type { SimulationRunner } from "../SimulationRunner";
import { LifeStage, Sex } from "../../../types/simulation/agents";
import { TileType } from "../../../../shared/constants/TileTypeEnums";
import { ZoneType } from "../../../../shared/constants/ZoneEnums";

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

    this.generateFunctionalZones(worldConfig, biomeMap);
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
            ageYears: 20, // Start as adults so they can work
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
        if (!this.runner.movementSystem.hasMovementState(agent.id)) {
          this.runner.movementSystem.initializeEntityMovement(
            agent.id,
            agent.position,
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
    const chunkTileSize = 16; // tiles per chunk
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
        building: "house" as BuildingLabel,
        underConstruction: false,
        buildingId: `building_house_initial_${Date.now()}`,
        builtAt: Date.now(),
        biome: defaultBiome,
        buildingType: "house",
        spriteVariant: 0,
      },
    };

    const workbenchZone: Zone = {
      id: `zone_workbench_initial_${Date.now()}`,
      type: ZoneType.WORK,
      bounds: {
        x: baseX + 100,
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
        buildingType: "workshop",
        spriteVariant: 0,
      },
    };

    const storageZone: Zone = {
      id: `zone_storage_initial_${Date.now()}`,
      type: ZoneType.STORAGE,
      bounds: {
        x: baseX + 100,
        y: baseY + 50,
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
        buildingType: "workshop",
        spriteVariant: 1,
      },
    };

    const restZone: Zone = {
      id: `zone_rest_initial_${Date.now()}`,
      type: ZoneType.REST,
      bounds: {
        x: baseX + 10,
        y: baseY + 10,
        width: 30,
        height: 40,
      },
      props: {
        restQuality: 0.8,
        beds: 6,
      },
      metadata: {
        parentZoneId: houseZone.id,
        biome: defaultBiome,
        buildingType: "house",
        spriteVariant: 1,
      },
    };

    const kitchenZone: Zone = {
      id: `zone_kitchen_initial_${Date.now()}`,
      type: ZoneType.KITCHEN,
      bounds: {
        x: baseX + 45,
        y: baseY + 10,
        width: 25,
        height: 25,
      },
      props: {
        cookingSpeed: 1.0,
        foodCapacity: 50,
      },
      metadata: {
        parentZoneId: houseZone.id,
        biome: defaultBiome,
        buildingType: "workshop",
        spriteVariant: 2,
      },
    };

    this.runner.state.zones.push(
      houseZone,
      workbenchZone,
      storageZone,
      restZone,
      kitchenZone,
    );

    logger.info(`🏠 Initial infrastructure created:`);
    logger.info(`   - Family house (shelter) at (${baseX}, ${baseY})`);
    logger.info(`   - Workbench at (${baseX + 100}, ${baseY})`);
    logger.info(`   - Storage zone`);
    logger.info(`   - Rest zone (inside house)`);
    logger.info(`   - Kitchen zone (inside house)`);
    logger.info(`📦 Starting resources: wood=50, stone=30, food=40, water=40`);
  }

  private generateFunctionalZones(
    worldConfig: {
      width: number;
      height: number;
      tileSize: number;
    },
    biomeMap: string[][],
  ): void {
    if (!this.runner.state.zones) {
      this.runner.state.zones = [];
    }

    const ZONE_SPACING = 300;
    const ZONE_SIZE = 120;
    const zones: Zone[] = [];

    const worldPixelWidth = worldConfig.width * worldConfig.tileSize;
    const worldPixelHeight = worldConfig.height * worldConfig.tileSize;

    for (let x = ZONE_SPACING; x < worldPixelWidth; x += ZONE_SPACING) {
      for (let y = ZONE_SPACING; y < worldPixelHeight; y += ZONE_SPACING) {
        const tileX = Math.floor(x / worldConfig.tileSize);
        const tileY = Math.floor(y / worldConfig.tileSize);

        if (
          tileY >= 0 &&
          tileY < biomeMap.length &&
          tileX >= 0 &&
          tileX < biomeMap[0].length
        ) {
          const biome = biomeMap[tileY][tileX];

          if (biome === "ocean" || biome === "lake") continue;

          const zoneType = this.determineZoneType(biome, x, y, worldConfig);
          if (!zoneType) continue;

          const zoneId = `zone_${zoneType}_${x}_${y}`;
          const normalizedBiome = this.normalizeBiomeForSprite(biome);
          const variantIndex = Math.floor(((x * 31 + y * 17) % 100) / 20);

          const zone: Zone = {
            id: zoneId,
            type: zoneType,
            bounds: {
              x: Math.max(0, x - ZONE_SIZE / 2),
              y: Math.max(0, y - ZONE_SIZE / 2),
              width: ZONE_SIZE,
              height: ZONE_SIZE,
            },
            props: {
              color: this.getZoneColor(zoneType),
              status: "ready",
            },
            metadata: {
              biome: normalizedBiome,
              spriteVariant: variantIndex,
              buildingType: this.getZoneBuildingType(zoneType),
            },
          };

          zones.push(zone);
        }
      }
    }

    this.runner.state.zones.push(...zones);
    logger.info(`Generated ${zones.length} functional zones`);
  }

  private determineZoneType(
    biome: string,
    x: number,
    y: number,
    worldConfig: { width: number; height: number },
  ): ZoneType | null {
    const seed = x * 1000 + y;
    const rng = (): number => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const centerX = worldConfig.width / 2;
    const centerY = worldConfig.height / 2;
    const distFromCenter = Math.hypot(x - centerX, y - centerY);
    const isNearCenter = distFromCenter < worldConfig.width * 0.3;

    if (isNearCenter && rng() < 0.3) {
      return ZoneType.SOCIAL;
    }

    if (biome === "forest" && rng() < 0.4) {
      return ZoneType.REST;
    }

    if (biome === "grassland" && rng() < 0.3) {
      return ZoneType.WORK;
    }

    const rand = rng();
    if (rand < 0.25) return ZoneType.REST;
    if (rand < 0.5) return ZoneType.WORK;
    if (rand < 0.7) return ZoneType.FOOD;
    if (rand < 0.85) return ZoneType.WATER;
    return ZoneType.SOCIAL;
  }

  private getZoneColor(zoneType: string): string {
    const colors: Record<string, string> = {
      rest: "#8B7355",
      work: "#6B8E23",
      food: "#FF6347",
      water: "#4682B4",
      social: "#9370DB",
      crafting: "#CD853F",
    };
    return colors[zoneType] || "#C4B998";
  }

  /**
   * Normalizes biome name to match asset folder names.
   *
   * Maps backend biome names (lowercase) to asset folder names (capitalized).
   * Backend: grassland, forest, desert, mountain, wetland, mystical, village
   * Assets: Grassland, Forest, Desert, Mountain, Swamp, Beach, Tundra
   *
   * @param biome - Backend biome name
   * @returns Normalized biome name for sprite lookup
   */
  private normalizeBiomeForSprite(biome: string): string {
    const biomeMapping: Record<string, string> = {
      grassland: "Grassland",
      forest: "Forest",
      desert: "Desert",
      mountain: "Mountain",
      mountainous: "Mountain",
      wetland: "Swamp",
      swamp: "Swamp",
      mystical: "Forest",
      village: "Grassland",
      beach: "Beach",
      tundra: "Tundra",
      ocean: "Beach",
      lake: "Beach",
    };
    return biomeMapping[biome.toLowerCase()] || "Grassland";
  }

  /**
   * Determines building sprite type based on zone type.
   *
   * Maps zone types to available sprite types: house, workshop, watchtower.
   *
   * @param zoneType - Zone type string
   * @returns Building sprite type
   */
  private getZoneBuildingType(zoneType: string): string {
    const buildingTypeMapping: Record<string, string> = {
      rest: "house",
      shelter: "house",
      bedroom: "house",
      living: "house",
      bathroom: "house",
      comfort: "house",

      work: "workshop",
      kitchen: "workshop",
      office: "workshop",
      storage: "workshop",
      market: "workshop",
      food: "workshop",
      water: "workshop",
      crafting: "workshop",
      energy: "workshop",

      defense: "watchtower",
      security: "watchtower",
      medical: "watchtower",
      spiritual: "watchtower",

      social: "house",
      recreation: "house",
      entertainment: "house",
      fun: "house",
      play: "house",
      library: "workshop",
      education: "workshop",
      training: "workshop",
      knowledge: "workshop",
      gym: "workshop",
      hygiene: "house",
    };
    return buildingTypeMapping[zoneType] || "house";
  }
}
