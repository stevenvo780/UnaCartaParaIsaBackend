import { logger } from "../../../../infrastructure/utils/logger";
import { Zone } from "../../../types/game-types";
import { BiomeType } from "../../../world/generation/types";
import type { BuildingLabel } from "../../../types/simulation/buildings";
import type { SimulationRunner } from "../SimulationRunner";

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
      type: "grass" | "stone" | "water" | "path";
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
              const tileType: "grass" | "stone" | "water" | "path" =
                tile.biome === BiomeType.OCEAN ? "water" : "grass";
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
      width: worldConfig.width,
      height: worldConfig.height,
    };
    logger.info(`Generated ${allTiles.length} terrain tiles.`);

    this.runner.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap,
    });

    // Animals are spawned per-chunk only (lazy loading via /api/world/chunk endpoint)
    // See AnimalSpawning.spawnAnimalsInChunk() called from worldController

    this.generateFunctionalZones(worldConfig, biomeMap);
  }

  public async ensureInitialFamily(): Promise<void> {
    let isa = this.runner.state.agents.find((a) => a.id === "isa");
    if (!isa) {
      isa = this.runner.lifeCycleSystem.spawnAgent({
        id: "isa",
        name: "Isa",
        sex: "female",
        ageYears: 25,
        lifeStage: "adult",
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

    let stev = this.runner.state.agents.find((a) => a.id === "stev");
    if (!stev) {
      stev = this.runner.lifeCycleSystem.spawnAgent({
        id: "stev",
        name: "Stev",
        sex: "male",
        ageYears: 27,
        lifeStage: "adult",
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
      { name: "Luna", sex: "female" as const },
      { name: "Sol", sex: "male" as const },
      { name: "Estrella", sex: "female" as const },
      { name: "Cielo", sex: "male" as const },
      { name: "Mar", sex: "female" as const },
      { name: "Rio", sex: "male" as const },
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
            ageYears: 5,
            lifeStage: "child",
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
            x: (this.runner.state.worldSize?.width ?? 128) * 16,
            y: (this.runner.state.worldSize?.height ?? 128) * 16,
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

    // Animals are spawned per-chunk only (lazy loading via /api/world/chunk endpoint)
    // No global animal spawn to avoid position inconsistencies
    logger.info(
      "🐾 Animals will be spawned when chunks are requested by frontend",
    );
  }

  // NOTE: ensureInitialAnimals was removed.
  // Animals are ONLY spawned per-chunk via AnimalSpawning.spawnAnimalsInChunk()
  // This is triggered when frontend requests chunks via /api/world/chunk/:x/:y

  private createInitialInfrastructure(): void {
    const baseX = 100;
    const baseY = 100;

    // Bioma por defecto para el pueblo inicial
    const defaultBiome = "Grassland";

    const houseZone: Zone = {
      id: `zone_house_initial_${Date.now()}`,
      type: "shelter",
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
        // Metadatos para sprite por bioma
        biome: defaultBiome,
        buildingType: "house",
        spriteVariant: 0,
      },
    };

    const workbenchZone: Zone = {
      id: `zone_workbench_initial_${Date.now()}`,
      type: "work",
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
        // Metadatos para sprite por bioma
        biome: defaultBiome,
        buildingType: "workshop",
        spriteVariant: 0,
      },
    };

    const storageZone: Zone = {
      id: `zone_storage_initial_${Date.now()}`,
      type: "storage",
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
        // Metadatos para sprite por bioma
        biome: defaultBiome,
        buildingType: "workshop",
        spriteVariant: 1,
      },
    };

    const restZone: Zone = {
      id: `zone_rest_initial_${Date.now()}`,
      type: "rest",
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
        // Metadatos para sprite por bioma (usa mismo que la casa padre)
        biome: defaultBiome,
        buildingType: "house",
        spriteVariant: 1,
      },
    };

    const kitchenZone: Zone = {
      id: `zone_kitchen_initial_${Date.now()}`,
      type: "kitchen",
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
        // Metadatos para sprite por bioma
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

    for (let x = ZONE_SPACING; x < worldConfig.width; x += ZONE_SPACING) {
      for (let y = ZONE_SPACING; y < worldConfig.height; y += ZONE_SPACING) {
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
          // Normalizar bioma para sprite (capitalizar primera letra)
          const normalizedBiome = this.normalizeBiomeForSprite(biome);
          // Obtener variante aleatoria (0-4)
          const variantIndex = Math.floor(
            ((x * 31 + y * 17) % 100) / 20,
          );

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
  ): string | null {
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
      return "social";
    }

    if (biome === "forest" && rng() < 0.4) {
      return "rest";
    }

    if (biome === "grassland" && rng() < 0.3) {
      return "work";
    }

    const rand = rng();
    if (rand < 0.25) return "rest";
    if (rand < 0.5) return "work";
    if (rand < 0.7) return "food";
    if (rand < 0.85) return "water";
    return "social";
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
   * Normaliza el nombre del bioma para coincidir con los nombres de carpetas de assets
   * backend: grassland, forest, desert, mountain, wetland, mystical, village
   * assets: Grassland, Forest, Desert, Mountain, Swamp, Beach, Tundra
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
      mystical: "Forest", // Usa Forest como fallback
      village: "Grassland",
      beach: "Beach",
      tundra: "Tundra",
      ocean: "Beach",
      lake: "Beach",
    };
    return biomeMapping[biome.toLowerCase()] || "Grassland";
  }

  /**
   * Determina el tipo de edificio sprite basado en el tipo de zona
   * Mapea tipos de zona a tipos de sprites disponibles: house, workshop, watchtower
   */
  private getZoneBuildingType(zoneType: string): string {
    const buildingTypeMapping: Record<string, string> = {
      // Casas/descanso
      rest: "house",
      shelter: "house",
      bedroom: "house",
      living: "house",
      bathroom: "house",
      comfort: "house",

      // Trabajo/producción
      work: "workshop",
      kitchen: "workshop",
      office: "workshop",
      storage: "workshop",
      market: "workshop",
      food: "workshop",
      water: "workshop",
      crafting: "workshop",
      energy: "workshop",

      // Torres/defensa/servicios
      defense: "watchtower",
      security: "watchtower",
      medical: "watchtower",
      spiritual: "watchtower",

      // Servicios sociales/educación (usa house por defecto)
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

  // NOTE: spawnInitialAnimals was removed.
  // Animals are ONLY spawned per-chunk via AnimalSpawning.spawnAnimalsInChunk()
  // This is triggered when frontend requests chunks via /api/world/chunk/:x/:y
}
