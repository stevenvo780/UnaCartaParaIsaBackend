import { EventEmitter } from "node:events";
import type { GameResources, GameState, Zone } from "../../types/game-types";
import { cloneGameState, createInitialGameState } from "./defaultState";
import { worldGenerationService } from "../../../infrastructure/services/world/worldGenerationService";
import { BiomeType } from "../../world/generation/types";
import { logger } from "../../../infrastructure/utils/logger";
import { WorldResourceSystem } from "../systems/WorldResourceSystem";
import { LivingLegendsSystem } from "../systems/LivingLegendsSystem";
import { LifeCycleSystem } from "../systems/LifeCycleSystem";
import { NeedsSystem } from "../systems/NeedsSystem";
import { GenealogySystem } from "../systems/GenealogySystem";
import { SocialSystem } from "../systems/SocialSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { EconomySystem } from "../systems/EconomySystem";
import { MarketSystem } from "../systems/MarketSystem";
import { RoleSystem } from "../systems/RoleSystem";
import { AISystem } from "../systems/AISystem";
import { ResourceReservationSystem } from "../systems/ResourceReservationSystem";
import { GovernanceSystem } from "../systems/GovernanceSystem";
import { DivineFavorSystem } from "../systems/DivineFavorSystem";
import { HouseholdSystem } from "../systems/HouseholdSystem";
import { BuildingSystem } from "../systems/BuildingSystem";
import { BuildingMaintenanceSystem } from "../systems/BuildingMaintenanceSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { EnhancedCraftingSystem } from "../systems/EnhancedCraftingSystem";
import { AnimalSystem } from "../systems/AnimalSystem";
import { ItemGenerationSystem } from "../systems/ItemGenerationSystem";
import { ReputationSystem } from "../systems/ReputationSystem";
import { ResearchSystem } from "../systems/ResearchSystem";
import { RecipeDiscoverySystem } from "../systems/RecipeDiscoverySystem";
import { QuestSystem } from "../systems/QuestSystem";
import { TaskSystem } from "../systems/TaskSystem";
import { TradeSystem } from "../systems/TradeSystem";
import { MarriageSystem } from "../systems/MarriageSystem";
import { ConflictResolutionSystem } from "../systems/ConflictResolutionSystem";
import { NormsSystem } from "../systems/NormsSystem";
import { simulationEvents, GameEventNames } from "./events";
import { CombatSystem } from "../systems/CombatSystem";
import { ResourceAttractionSystem } from "../systems/ResourceAttractionSystem";
import { CrisisPredictorSystem } from "../systems/CrisisPredictorSystem";
import { AmbientAwarenessSystem } from "../systems/AmbientAwarenessSystem";
import { CardDialogueSystem } from "../systems/CardDialogueSystem";
import { EmergenceSystem } from "../systems/EmergenceSystem";
import { TimeSystem } from "../systems/TimeSystem";
import { InteractionGameSystem } from "../systems/InteractionGameSystem";
import { KnowledgeNetworkSystem } from "../systems/KnowledgeNetworkSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { TrailSystem } from "../systems/TrailSystem";
import type { BuildingLabel } from "../../types/simulation/buildings";
import { AppearanceGenerationSystem } from "../systems/AppearanceGenerationSystem";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
  SimulationEventPayload,
  NeedsCommandPayload,
  RecipeCommandPayload,
  SocialCommandPayload,
  ResearchCommandPayload,
  WorldResourceCommandPayload,
  DialogueCommandPayload,
  BuildingCommandPayload,
  ReputationCommandPayload,
  TaskCommandPayload,
} from "../../../shared/types/commands/SimulationCommand";
import type { NeedsConfig } from "../../types/simulation/needs";
import type { TaskType, TaskMetadata } from "../../types/simulation/tasks";
interface SimulationEventMap {
  tick: SimulationSnapshot;
  commandRejected: SimulationCommand;
}

export class SimulationRunner {
  private state: GameState;
  private readonly emitter = new EventEmitter();
  private readonly commands: SimulationCommand[] = [];
  private readonly tickIntervalMs: number;
  private readonly maxCommandQueue: number;
  private tickHandle?: NodeJS.Timeout;
  private tickCounter = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  private lastUpdate = Date.now();
  private timeScale = 1;
  private worldResourceSystem: WorldResourceSystem;
  private livingLegendsSystem: LivingLegendsSystem;
  private lifeCycleSystem: LifeCycleSystem;
  private needsSystem: NeedsSystem;
  private readonly _genealogySystem: GenealogySystem;
  private socialSystem: SocialSystem;
  private inventorySystem: InventorySystem;
  private economySystem: EconomySystem;
  private marketSystem: MarketSystem;
  private roleSystem: RoleSystem;
  private aiSystem: AISystem;
  private resourceReservationSystem: ResourceReservationSystem;
  private governanceSystem: GovernanceSystem;
  private divineFavorSystem: DivineFavorSystem;
  private householdSystem: HouseholdSystem;
  private buildingSystem: BuildingSystem;
  private buildingMaintenanceSystem: BuildingMaintenanceSystem;
  private productionSystem: ProductionSystem;
  private enhancedCraftingSystem: EnhancedCraftingSystem;
  private animalSystem: AnimalSystem;
  private itemGenerationSystem: ItemGenerationSystem;
  private combatSystem: CombatSystem;
  private reputationSystem: ReputationSystem;
  private _researchSystem: ResearchSystem;
  private _recipeDiscoverySystem: RecipeDiscoverySystem;
  private questSystem: QuestSystem;
  private taskSystem: TaskSystem;
  private tradeSystem: TradeSystem;
  private marriageSystem: MarriageSystem;
  private conflictResolutionSystem: ConflictResolutionSystem;
  private _normsSystem: NormsSystem;
  private resourceAttractionSystem: ResourceAttractionSystem;
  private crisisPredictorSystem: CrisisPredictorSystem;
  private ambientAwarenessSystem: AmbientAwarenessSystem;
  private cardDialogueSystem: CardDialogueSystem;
  private emergenceSystem: EmergenceSystem;
  private timeSystem: TimeSystem;
  private interactionGameSystem: InteractionGameSystem;
  private knowledgeNetworkSystem: KnowledgeNetworkSystem;
  private movementSystem: MovementSystem;
  private trailSystem: TrailSystem;
  private appearanceGenerationSystem: AppearanceGenerationSystem;
  private capturedEvents: SimulationEvent[] = [];
  private eventCaptureListener?: (eventName: string, payload: unknown) => void;

  constructor(config?: Partial<SimulationConfig>, initialState?: GameState) {
    this.state = initialState ?? createInitialGameState();
    this.tickIntervalMs = config?.tickIntervalMs ?? 200;
    this.maxCommandQueue = config?.maxCommandQueue ?? 200;
    this.worldResourceSystem = new WorldResourceSystem(this.state);
    this.livingLegendsSystem = new LivingLegendsSystem(this.state);

    this.lifeCycleSystem = new LifeCycleSystem(this.state);
    this.needsSystem = new NeedsSystem(this.state);
    this._genealogySystem = new GenealogySystem(this.state);
    this.socialSystem = new SocialSystem(this.state);
    this.inventorySystem = new InventorySystem(this.state);
    this.resourceReservationSystem = new ResourceReservationSystem(
      this.state,
      this.inventorySystem,
    );
    this.divineFavorSystem = new DivineFavorSystem();
    this.householdSystem = new HouseholdSystem(this.state);
    this.marriageSystem = new MarriageSystem(this.state);
    this.roleSystem = new RoleSystem(this.state);

    this.governanceSystem = new GovernanceSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
      this.divineFavorSystem,
      this.resourceReservationSystem,
    );
    this.economySystem = new EconomySystem(
      this.state,
      this.inventorySystem,
      this.socialSystem,
    );
    this.economySystem.setDependencies({
      roleSystem: this.roleSystem,
      divineFavorSystem: this.divineFavorSystem,
      genealogySystem: this._genealogySystem,
    });
    this.marketSystem = new MarketSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
    );

    this.aiSystem = new AISystem(this.state);

    this.buildingMaintenanceSystem = new BuildingMaintenanceSystem(
      this.state,
      this.inventorySystem,
    );
    this.buildingSystem = new BuildingSystem(
      this.state,
      this.resourceReservationSystem,
    );
    this.productionSystem = new ProductionSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
    );
    this.enhancedCraftingSystem = new EnhancedCraftingSystem(
      this.state,
      this.inventorySystem,
    );
    this.animalSystem = new AnimalSystem(
      this.state,
      undefined,
      this.worldResourceSystem,
    );
    this.itemGenerationSystem = new ItemGenerationSystem(this.state);
    this.combatSystem = new CombatSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
      this.socialSystem,
      undefined,
      this.animalSystem,
    );
    this.reputationSystem = new ReputationSystem(this.state);
    this._researchSystem = new ResearchSystem(this.state);
    this._recipeDiscoverySystem = new RecipeDiscoverySystem(this.state);
    this.questSystem = new QuestSystem(this.state);
    this.taskSystem = new TaskSystem(this.state);
    // Connect TaskSystem to BuildingSystem after both are created
    if (this.buildingSystem) {
      this.buildingSystem.setTaskSystem(this.taskSystem);
    }
    this.tradeSystem = new TradeSystem(this.state, this.inventorySystem);
    this.conflictResolutionSystem = new ConflictResolutionSystem(this.state);
    this._normsSystem = new NormsSystem(this.state);
    this.resourceAttractionSystem = new ResourceAttractionSystem(
      this.state,
      this.needsSystem,
    );
    this.crisisPredictorSystem = new CrisisPredictorSystem(
      this.state,
      this.needsSystem,
    );
    this.ambientAwarenessSystem = new AmbientAwarenessSystem(
      this.state,
      this.needsSystem,
    );
    this.cardDialogueSystem = new CardDialogueSystem(
      this.state,
      this.needsSystem,
      this.socialSystem,
      this.questSystem,
    );
    this.timeSystem = new TimeSystem(this.state);
    this.emergenceSystem = new EmergenceSystem(this.state, undefined, {
      needsSystem: this.needsSystem,
      socialSystem: this.socialSystem,
      lifeCycleSystem: this.lifeCycleSystem,
      economySystem: this.economySystem,
    });
    this.interactionGameSystem = new InteractionGameSystem(this.state);
    this.knowledgeNetworkSystem = new KnowledgeNetworkSystem(this.state);
    this.movementSystem = new MovementSystem(this.state);
    this.trailSystem = new TrailSystem(this.state);
    this.appearanceGenerationSystem = new AppearanceGenerationSystem();

    this.lifeCycleSystem.setDependencies({
      needsSystem: this.needsSystem,
      inventorySystem: this.inventorySystem,
      householdSystem: this.householdSystem,
      movementSystem: this.movementSystem,
    });

    this.needsSystem.setDependencies({
      lifeCycleSystem: this.lifeCycleSystem,
      divineFavorSystem: this.divineFavorSystem,
      inventorySystem: this.inventorySystem,
      socialSystem: this.socialSystem,
    });

    this.aiSystem.setDependencies({
      needsSystem: this.needsSystem,
      roleSystem: this.roleSystem,
      worldResourceSystem: this.worldResourceSystem,
      inventorySystem: this.inventorySystem,
      socialSystem: this.socialSystem,
      craftingSystem: this.enhancedCraftingSystem,
      movementSystem: this.movementSystem,
      householdSystem: this.householdSystem,
      taskSystem: this.taskSystem,
      combatSystem: this.combatSystem,
      animalSystem: this.animalSystem,
      questSystem: this.questSystem,
      timeSystem: this.timeSystem,
      buildingSystem: this.buildingSystem,
      productionSystem: this.productionSystem,
      tradeSystem: this.tradeSystem,
      reputationSystem: this.reputationSystem,
    });

    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      (data: { agentId: string; action: string }) => {
        if (data.action === "birth") {
          const agent = this.state.agents.find((a) => a.id === data.agentId);
          if (agent) {
            this._genealogySystem.registerBirth(
              agent,
              agent.parents?.father,
              agent.parents?.mother,
            );
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.AGENT_BIRTH,
      (data: { entityId: string; parentIds: [string, string] | null }) => {
        const agent = this.state.agents.find((a) => a.id === data.entityId);
        if (agent) {
          const fatherId = data.parentIds ? data.parentIds[0] : undefined;
          const motherId = data.parentIds ? data.parentIds[1] : undefined;
          this.appearanceGenerationSystem.generateAppearance(
            agent.id,
            agent,
            fatherId,
            motherId,
          );
        }
      },
    );

    simulationEvents.on(
      GameEventNames.COMBAT_KILL,
      (data: { targetId: string }) => {
        this._genealogySystem.recordDeath(data.targetId);
      },
    );

    simulationEvents.on(
      GameEventNames.ANIMAL_HUNTED,
      (data: {
        animalId: string;
        hunterId: string;
        foodValue?: number;
      }) => {
        if (data.hunterId && data.foodValue) {
          // Give food to the hunter
          const inventory = this.inventorySystem.getAgentInventory(
            data.hunterId,
          );
          if (inventory) {
            const foodToAdd = Math.floor(data.foodValue || 5);
            this.inventorySystem.addResource(
              data.hunterId,
              "food",
              foodToAdd,
            );
          }
        }
      },
    );

    const eventCaptureListener = (
      eventName: string,
      payload: unknown,
    ): void => {
      this.capturedEvents.push({
        type: eventName,
        payload: payload as SimulationEventPayload | undefined,
        timestamp: Date.now(),
      });
    };
    this.eventCaptureListener = eventCaptureListener;

    Object.values(GameEventNames).forEach((eventName) => {
      simulationEvents.on(eventName, (payload: unknown) => {
        if (this.eventCaptureListener) {
          this.eventCaptureListener(eventName, payload);
        }
      });
    });

    if (this.state.agents.length === 0) {
      this.lifeCycleSystem.spawnAgent({
        name: "Isa",
        sex: "female",
        traits: {
          cooperation: 0.8,
          aggression: 0.2,
          diligence: 0.7,
          curiosity: 0.9,
        },
      });

      this.lifeCycleSystem.spawnAgent({
        name: "Stev",
        sex: "male",
        traits: {
          cooperation: 0.7,
          aggression: 0.3,
          diligence: 0.8,
          curiosity: 0.8,
        },
      });
    }
  }

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
        const chunkTiles = await worldGenerationService.generateChunk(cx, cy, {
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
              biomeMap[tile.y][tile.x] = tile.biome;
            }
          }
        }
      }
    }

    this.state.terrainTiles = allTiles;
    this.state.worldSize = {
      width: worldConfig.width,
      height: worldConfig.height,
    };
    logger.info(`Generated ${allTiles.length} terrain tiles.`);

    this.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap,
    });

    this.animalSystem.spawnAnimalsInWorld(
      worldConfig.width,
      worldConfig.height,
      worldConfig.tileSize,
      biomeMap,
    );

    // Generate functional zones based on biomes
    this.generateFunctionalZones(worldConfig, biomeMap);
  }

  private generateFunctionalZones(
    worldConfig: {
      width: number;
      height: number;
      tileSize: number;
    },
    biomeMap: string[][],
  ): void {
    if (!this.state.zones) {
      this.state.zones = [];
    }

    const ZONE_SPACING = 300; // Distance between zones
    const ZONE_SIZE = 120; // Zone size
    const zones: Zone[] = [];

    // Generate zones in a grid pattern
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

          // Skip water biomes
          if (biome === "ocean" || biome === "lake") continue;

          // Determine zone type based on biome and position
          const zoneType = this.determineZoneType(biome, x, y, worldConfig);
          if (!zoneType) continue;

          const zoneId = `zone_${zoneType}_${x}_${y}`;
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
          };

          zones.push(zone);
        }
      }
    }

    // Add zones to state
    this.state.zones.push(...zones);
    logger.info(`Generated ${zones.length} functional zones`);
  }

  private determineZoneType(
    biome: string,
    x: number,
    y: number,
    worldConfig: { width: number; height: number },
  ): string | null {
    // Use deterministic randomness based on position
    const seed = x * 1000 + y;
    const rng = () => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Center areas are more likely to be social/work zones
    const centerX = worldConfig.width / 2;
    const centerY = worldConfig.height / 2;
    const distFromCenter = Math.hypot(x - centerX, y - centerY);
    const isNearCenter = distFromCenter < worldConfig.width * 0.3;

    if (isNearCenter && rng() < 0.3) {
      return "social";
    }

    // Forest biomes favor rest zones
    if (biome === "forest" && rng() < 0.4) {
      return "rest";
    }

    // Grassland biomes favor work zones
    if (biome === "grassland" && rng() < 0.3) {
      return "work";
    }

    // Default distribution
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

  start(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.step(), this.tickIntervalMs);
  }

  stop(): void {
    if (!this.tickHandle) return;
    clearInterval(this.tickHandle);
    this.tickHandle = undefined;
  }

  enqueueCommand(command: SimulationCommand): boolean {
    if (this.commands.length >= this.maxCommandQueue) {
      this.emitter.emit("commandRejected", command);
      return false;
    }
    this.commands.push(command);
    return true;
  }

  getSnapshot(): SimulationSnapshot {
    const events =
      this.capturedEvents.length > 0 ? [...this.capturedEvents] : undefined;
    const snapshotState = cloneGameState(this.state);
    snapshotState.genealogy = this._genealogySystem.getSerializedFamilyTree();

    const allLegends = this.livingLegendsSystem.getAllLegends();
    const activeLegends = this.livingLegendsSystem.getActiveLegends();
    snapshotState.legends = {
      records: allLegends,
      activeLegends,
    };

    return {
      state: snapshotState,
      tick: this.tickCounter,
      updatedAt: this.lastUpdate,
      events,
    };
  }

  private step(): void {
    const now = Date.now();
    const delta = now - this.lastUpdate;
    this.lastUpdate = now;

    this.processCommands();
    const scaledDelta = delta * this.timeScale;

    this.advanceSimulation(scaledDelta);
    this.worldResourceSystem.update(scaledDelta);
    this.livingLegendsSystem.update(scaledDelta);
    this.lifeCycleSystem.update(scaledDelta);
    this.needsSystem.update(scaledDelta);
    this.socialSystem.update(scaledDelta);
    this.inventorySystem.update();
    this.resourceReservationSystem.update();
    this.economySystem.update(scaledDelta);
    this.marketSystem.update(scaledDelta);
    this.roleSystem.update(scaledDelta);
    this.aiSystem.update(scaledDelta);
    this.divineFavorSystem.update(scaledDelta);
    this.governanceSystem.update(scaledDelta);
    this.householdSystem.update(scaledDelta);
    this.buildingSystem.update(scaledDelta);
    this.buildingMaintenanceSystem.update(scaledDelta);
    this.productionSystem.update(scaledDelta);
    this.enhancedCraftingSystem.update();
    this.animalSystem.update(scaledDelta);
    this.itemGenerationSystem.update(scaledDelta);
    this.combatSystem.update(scaledDelta);
    this.reputationSystem.update();
    this.questSystem.update();
    this.taskSystem.update();
    this.tradeSystem.update();
    this.marriageSystem.update();
    this.conflictResolutionSystem.update();
    this.resourceAttractionSystem.update(scaledDelta);
    this.crisisPredictorSystem.update(scaledDelta);
    this.ambientAwarenessSystem.update(scaledDelta);
    this.cardDialogueSystem.update(scaledDelta);
    this.timeSystem.update(scaledDelta);
    this.emergenceSystem.update(scaledDelta);
    this.interactionGameSystem.update(scaledDelta);
    this.knowledgeNetworkSystem.update(scaledDelta);
    this.movementSystem.update(scaledDelta);
    this.trailSystem.update(scaledDelta);
    this._researchSystem.update();
    this._recipeDiscoverySystem.update();
    this._normsSystem.update();

    this.tickCounter += 1;
    const snapshot = this.getSnapshot();
    this.emitter.emit("tick", snapshot);

    this.capturedEvents = [];
  }

  private processCommands(): void {
    while (this.commands.length > 0) {
      const command = this.commands.shift();
      if (!command) break;
      switch (command.type) {
        case "SET_TIME_SCALE":
          this.timeScale = Math.max(0.1, Math.min(10, command.multiplier));
          break;
        case "APPLY_RESOURCE_DELTA":
          this.applyResourceDelta(command.delta);
          break;
        case "GATHER_RESOURCE":
          simulationEvents.emit(GameEventNames.RESOURCE_GATHERED, {
            resourceId: command.resourceId,
            amount: command.amount,
          });
          break;
        case "SPAWN_AGENT":
          this.lifeCycleSystem.spawnAgent(
            command.payload as Partial<
              import("../../types/simulation/agents").AgentProfile
            >,
          );
          break;
        case "KILL_AGENT":
          this.lifeCycleSystem.removeAgent(command.agentId);
          break;
        case "AGENT_COMMAND":
          this.handleAgentCommand(command);
          break;
        case "ANIMAL_COMMAND":
          this.handleAnimalCommand(command);
          break;
        case "NEEDS_COMMAND":
          this.handleNeedsCommand(command);
          break;
        case "RECIPE_COMMAND":
          this.handleRecipeCommand(command);
          break;
        case "SOCIAL_COMMAND":
          this.handleSocialCommand(command);
          break;
        case "RESEARCH_COMMAND":
          this.handleResearchCommand(command);
          break;
        case "WORLD_RESOURCE_COMMAND":
          this.handleWorldResourceCommand(command);
          break;
        case "DIALOGUE_COMMAND":
          this.handleDialogueCommand(command);
          break;
        case "BUILDING_COMMAND":
          this.handleBuildingCommand(command);
          break;
        case "REPUTATION_COMMAND":
          this.handleReputationCommand(command);
          break;
        case "TASK_COMMAND":
          this.handleTaskCommand(command);
          break;
        case "FORCE_EMERGENCE_EVALUATION":
          this.emergenceSystem.forcePatternEvaluation();
          break;
        case "PING":
        default:
          break;
      }
    }
  }

  private handleAgentCommand(
    command: Extract<SimulationCommand, { type: "AGENT_COMMAND" }>,
  ): void {
    if (!command.agentId) return;
    if (!this.ensureMovementState(command.agentId)) return;

    const payload = command.payload;

    switch (command.command) {
      case "MOVE_TO":
        if (
          payload &&
          typeof payload.x === "number" &&
          typeof payload.y === "number"
        ) {
          this.movementSystem.moveToPoint(
            command.agentId,
            payload.x,
            payload.y,
          );
          simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
            agentId: command.agentId,
            action: "move",
            payload,
          });
        }
        break;
      case "STOP_MOVEMENT":
        this.movementSystem.stopMovement(command.agentId);
        break;
      default:
        break;
    }
  }

  private handleAnimalCommand(
    command: Extract<SimulationCommand, { type: "ANIMAL_COMMAND" }>,
  ): void {
    if (command.command !== "SPAWN_ANIMAL") return;
    const payload = command.payload;
    if (
      !payload ||
      typeof payload.type !== "string" ||
      !payload.position ||
      typeof payload.position.x !== "number" ||
      typeof payload.position.y !== "number"
    ) {
      return;
    }

    this.animalSystem.spawnAnimal(
      payload.type,
      payload.position,
      payload.biome as string | undefined,
    );
  }

  private handleNeedsCommand(
    command: Extract<SimulationCommand, { type: "NEEDS_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as NeedsCommandPayload);
    switch (command.command) {
      case "SATISFY_NEED":
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.amount === "number"
        ) {
          this.needsSystem.satisfyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.amount,
          );
        }
        break;
      case "MODIFY_NEED":
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.delta === "number"
        ) {
          this.needsSystem.modifyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.delta,
          );
        }
        break;
      case "UPDATE_CONFIG":
        this.needsSystem.updateConfig(payload as Partial<NeedsConfig>);
        break;
    }
  }

  private handleRecipeCommand(
    command: Extract<SimulationCommand, { type: "RECIPE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as RecipeCommandPayload);
    switch (command.command) {
      case "TEACH_RECIPE":
        if ((payload.agentId || payload.teacherId) && payload.recipeId) {
          this._recipeDiscoverySystem.teachRecipe(
            (payload.agentId as string) ?? (payload.teacherId as string) ?? "",
            payload.recipeId as string,
          );
        }
        break;
      case "SHARE_RECIPE":
        {
          const teacherId =
            (payload.teacherId as string | undefined) ??
            ((payload as Record<string, unknown>).fromAgentId as
              | string
              | undefined);
          const studentId =
            (payload.studentId as string | undefined) ??
            ((payload as Record<string, unknown>).toAgentId as
              | string
              | undefined);

          if (teacherId && studentId && payload.recipeId) {
            this._recipeDiscoverySystem.shareRecipe(
              teacherId,
              studentId,
              payload.recipeId as string,
            );
          }
        }
        break;
    }
  }

  private handleSocialCommand(
    command: Extract<SimulationCommand, { type: "SOCIAL_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as SocialCommandPayload);
    switch (command.command) {
      case "IMPOSE_TRUCE":
        if (
          payload.aId &&
          payload.bId &&
          typeof payload.durationMs === "number"
        ) {
          this.socialSystem.imposeTruce(
            payload.aId as string,
            payload.bId as string,
            payload.durationMs,
          );
        }
        break;
      case "SET_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.value === "number") {
          this.socialSystem.setAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.value,
          );
        }
        break;
      case "MODIFY_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.delta === "number") {
          this.socialSystem.modifyAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.delta,
          );
        }
        break;
      case "REMOVE_RELATIONSHIPS":
        if (payload.agentId) {
          this.socialSystem.removeRelationships(payload.agentId as string);
        }
        break;
      case "FRIENDLY_INTERACTION":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            (payload.magnitude as number) || 0.1,
          );
          this.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "friendly",
          );
        }
        break;
      case "HOSTILE_ENCOUNTER":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            -(payload.magnitude as number) || -0.1,
          );
          this.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "hostile",
          );
        }
        break;
    }
  }

  private handleResearchCommand(
    command: Extract<SimulationCommand, { type: "RESEARCH_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ResearchCommandPayload);
    switch (command.command) {
      case "INITIALIZE_LINEAGE":
        if (payload.lineageId) {
          this._researchSystem.initializeLineage(payload.lineageId as string);
        }
        break;
      case "RECIPE_DISCOVERED":
        if (payload.recipeId) {
          const lineageId = this.resolveLineageId(
            payload.lineageId as string | undefined,
          );
          const discoveredBy =
            (payload.discoveredBy as string | undefined) || "unknown";

          this._researchSystem.onRecipeDiscovered(
            lineageId,
            payload.recipeId as string,
            discoveredBy,
          );
        }
        break;
    }
  }

  private handleWorldResourceCommand(
    command: Extract<SimulationCommand, { type: "WORLD_RESOURCE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as WorldResourceCommandPayload);
    switch (command.command) {
      case "SPAWN_RESOURCE":
        if (payload.type && payload.position) {
          this.worldResourceSystem.spawnResource(
            payload.type as string,
            payload.position as { x: number; y: number },
            (payload.biome as string) || "grass",
          );
        }
        break;
      case "HARVEST_RESOURCE":
        if (payload.resourceId && payload.agentId) {
          this.worldResourceSystem.harvestResource(
            payload.resourceId as string,
            payload.agentId as string,
          );
        }
        break;
    }
  }

  private handleDialogueCommand(
    command: Extract<SimulationCommand, { type: "DIALOGUE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as DialogueCommandPayload);
    switch (command.command) {
      case "RESPOND_TO_CARD":
        if (payload.cardId && payload.choiceId) {
          this.cardDialogueSystem.respondToCard(
            payload.cardId as string,
            payload.choiceId as string,
          );
        }
        break;
    }
  }

  private handleBuildingCommand(
    command: Extract<SimulationCommand, { type: "BUILDING_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as BuildingCommandPayload);
    switch (command.command) {
      case "START_UPGRADE":
        if (payload.zoneId && payload.agentId) {
          this.buildingMaintenanceSystem.startUpgrade(
            payload.zoneId as string,
            payload.agentId as string,
          );
        }
        break;
      case "CANCEL_UPGRADE":
        if (payload.zoneId) {
          this.buildingMaintenanceSystem.cancelUpgrade(
            payload.zoneId as string,
          );
        }
        break;
      case "ENQUEUE_CONSTRUCTION":
        if (payload.buildingType) {
          this.buildingSystem.enqueueConstruction(
            payload.buildingType as BuildingLabel,
          );
        }
        break;
      case "CONSTRUCT_BUILDING":
        if (payload.buildingType) {
          this.buildingSystem.constructBuilding(
            payload.buildingType as BuildingLabel,
            payload.position as { x: number; y: number } | undefined,
          );
        }
        break;
    }
  }

  private handleReputationCommand(
    command: Extract<SimulationCommand, { type: "REPUTATION_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ReputationCommandPayload);
    switch (command.command) {
      case "UPDATE_TRUST":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.delta === "number"
        ) {
          this.reputationSystem.updateTrust(
            payload.agentA as string,
            payload.agentB as string,
            payload.delta,
          );
        }
        break;
    }
  }

  private handleTaskCommand(
    command: Extract<SimulationCommand, { type: "TASK_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as TaskCommandPayload);
    switch (command.command) {
      case "CREATE_TASK":
        if (payload.type && typeof payload.requiredWork === "number") {
          this.taskSystem.createTask({
            type: payload.type as TaskType,
            requiredWork: payload.requiredWork,
            bounds: payload.bounds as
              | { x: number; y: number; width: number; height: number }
              | undefined,
            zoneId: payload.zoneId as string | undefined,
            requirements: payload.requirements as
              | {
                  resources?: {
                    wood?: number;
                    stone?: number;
                    food?: number;
                    water?: number;
                  };
                  minWorkers?: number;
                }
              | undefined,
            metadata: payload.metadata as TaskMetadata | undefined,
            targetAnimalId: payload.targetAnimalId as string | undefined,
          });
        }
        break;
      case "CONTRIBUTE_TO_TASK":
        if (
          payload.taskId &&
          payload.agentId &&
          typeof payload.contribution === "number"
        ) {
          this.taskSystem.contributeToTask(
            payload.taskId as string,
            payload.agentId as string,
            payload.contribution,
            (payload.socialSynergyMultiplier as number) || 1.0,
          );
        }
        break;
      case "REMOVE_TASK":
        if (payload.taskId) {
          this.taskSystem.removeTask(payload.taskId as string);
        }
        break;
    }
  }

  private applyResourceDelta(delta: Partial<GameResources["materials"]>): void {
    if (!this.state.resources) {
      return;
    }
    const materials = this.state.resources.materials;
    for (const [key, value] of Object.entries(delta)) {
      const materialKey = key as keyof GameResources["materials"];
      const current = materials[materialKey] ?? 0;
      materials[materialKey] = current + (value ?? 0);
    }
  }

  private advanceSimulation(deltaMs: number): void {
    this.state.togetherTime += deltaMs;
    this.state.dayTime = ((this.state.dayTime ?? 0) + deltaMs) % 86400000;

    this.state.cycles += 1;

    if (this.state.resources) {
      const regenRate = deltaMs / 1000;
      this.state.resources.energy = Math.min(
        100,
        this.state.resources.energy + regenRate * 0.1,
      );
    }
  }

  private ensureMovementState(agentId: string): boolean {
    if (this.movementSystem.hasMovementState(agentId)) {
      return true;
    }

    const agent = this.state.agents.find((a) => a.id === agentId);
    if (!agent || !agent.position) {
      return false;
    }

    this.movementSystem.initializeEntityMovement(agentId, agent.position);
    return true;
  }

  private resolveLineageId(requested?: string): string {
    if (requested) {
      return requested;
    }

    const existing =
      this.state.research?.lineages && this.state.research.lineages.length > 0
        ? this.state.research.lineages[0].lineageId
        : undefined;

    const lineageId = existing ?? "lineage_default";
    if (!existing) {
      this._researchSystem.initializeLineage(lineageId);
    }
    return lineageId;
  }
}
